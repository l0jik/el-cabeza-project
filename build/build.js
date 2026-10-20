import * as esbuild from "esbuild";
import { writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync, rmSync, readFileSync } from "fs";
import { WORLDS } from "../themes/realities.js";

// The den's records: the user's tracks, each through tools/console_1974_turntable.py.
const DEN_RECORDS = {
  "el-cabeza-den-record-1.mp3": "assets/den/1974_console_master.mp3",
  // The commercial on the set: the user's spot (tools/den_spot.py), its
  // picture twice over (H.264; VP9 where there's no H.264) and its sound
  // (themes/den-commercial.js, den-ad-audio.js).
  "el-cabeza-den-spot.mp4": "assets/den/spot.mp4",
  "el-cabeza-den-spot.webm": "assets/den/spot.webm",
  "el-cabeza-den-spot.mp3": "assets/den/spot-sound.mp3",
  // The 8-track's tapes: the user's tracks through tools/den_8track_treatment.py.
  ...Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`el-cabeza-den-tape-${n}.mp3`, `assets/den/8track_${n}.mp3`])),
  // The pull down the hall (themes/den-hall.js): the dread under the walk
  // and under the drag (tools/hall_dread.py), the force field, his shout
  // and its preverb (tools/hall_sounds.py).
  "el-cabeza-hall-dread-walk.mp3": "assets/hall/dread-walk.mp3",
  "el-cabeza-hall-dread-drag.mp3": "assets/hall/dread-drag.mp3",
  "el-cabeza-hall-scream.mp3": "assets/hall/scream.mp3",
  "el-cabeza-hall-field.mp3": "assets/hall/field.mp3",
  "el-cabeza-hall-pre.mp3": "assets/hall/pre.mp3",
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
  ...Object.fromEntries(["den", "futuris", "store", "lluvia", "cromo", "plano", "luna", "noir", "ciudad", "parrish-orinoco", "parrish-watermark", "lab-swiss", "lab-bauhaus", "lab-destijl", "lab-brutalist",
    "lab-newTypography", "lab-corporateSwiss", "lab-neoBrutalist", "lab-minimalMono", "lab-ultimateFusion"].map((id) => [`el-cabeza-channel-${id}.jpg`, `assets/den/channels/${id}.jpg`])),
};

// The Singularity's first visit, after the ring: the user's industrial
// drone, looped (tools/futuris_sphere_drone.py; themes/futuris-unease.js createDrone).
const SPHERE_FILES = { "el-cabeza-futuris-sphere-drone.mp3": "assets/futuris/sphere-drone.mp3" };
DEN_RECORDS["el-cabeza-futuris-sphere-drone.mp3"] = SPHERE_FILES["el-cabeza-futuris-sphere-drone.mp3"];

// Beside every page: ABOUT's original-game cue (chassis ORIGINAL_CUE_URL),
// and the faces of the lines between scenes (themes/faces.js: Bodoni Moda,
// Comic Neue Bold and Bangers, their latin letters, SIL Open Font License,
// assets/fonts/OFL-*.txt), kept with the pages so a change of place can't
// take them away mid-fade.
const FACE_FILES = {
  "el-cabeza-face-bodoni.woff2": "assets/fonts/bodoni-moda.woff2",
  "el-cabeza-face-bodoni-italic.woff2": "assets/fonts/bodoni-moda-italic.woff2",
  "el-cabeza-face-comic-neue-bold.woff2": "assets/fonts/comic-neue-bold.woff2",
  "el-cabeza-face-bangers.woff2": "assets/fonts/bangers.woff2",
};
const COMMON_FILES = { "el-cabeza-original-cue.mp3": "assets/original-cue.mp3", ...FACE_FILES };
// Beside the pages with Futuris's Singularity: the lost hand (futuris-singularity.js).
const LOST_HAND = { "el-cabeza-lost-hand-wire.webp": "assets/futuris/lost-hand-wire.webp", "el-cabeza-lost-hand-skin.webp": "assets/futuris/lost-hand-skin.webp" };
Object.assign(SPHERE_FILES, LOST_HAND);
Object.assign(DEN_RECORDS, LOST_HAND);

// The Games counter's photographs (themes/tienda-overlay.js ClerkScene).
const CLERK_SHOTS = ["clerk-hello", "clerk-sure", "clerk-go", "clerk-hmm", "clerk-sorry", "clerk-phone",
  "manager-1", "manager-2", "manager-3", "manager-4", "manager-5", "manager-6", "manager-7", "manager-8"];
// The City's recorded hours and horns, beside its page and beside Nova's.
const CIUDAD_FILES = Object.fromEntries(
  ["morning", "afternoon", "golden", "overcast", "night"].map((h) => [`el-cabeza-ciudad-city-${h}.mp3`, `assets/ciudad/city-${h}.mp3`]).concat([["el-cabeza-ciudad-honks.mp3", "assets/ciudad/honks.mp3"]]));
/* Nova as an app on a phone's home screen (user: "Need the splash screen
   to automatically go full screen. That should be the first thing it
   does."): in a browser's tab only a tap can put a page full screen (the
   title screen does it at the first, apps/title-screen.js), but opened
   from its icon, the manifest's display "fullscreen" has it full screen
   from the start on Android; an iPhone opens it without Safari's bars.
   Its icons are the Horizon logo, from the title's held frame. */
const APP_HEAD = '<link rel="manifest" href="el-cabeza-nova.webmanifest"><link rel="icon" href="el-cabeza-icon-192.png"><link rel="apple-touch-icon" href="el-cabeza-icon-180.png">'
  + '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black"><meta name="apple-mobile-web-app-title" content="El Cabeza">';
const APP_FILES = {
  "el-cabeza-nova.webmanifest": "assets/app/manifest.webmanifest",
  "el-cabeza-icon-180.png": "assets/app/icon-180.png",
  "el-cabeza-icon-192.png": "assets/app/icon-192.png",
  "el-cabeza-icon-512.png": "assets/app/icon-512.png",
  "el-cabeza-icon-maskable-512.png": "assets/app/icon-maskable-512.png",
};
const targets = [
  // The den's records (themes/standard.js DEN_TRACKS), files beside the
  // page like Tienda's reels: fetched when played. Nova's den reads the same.
  { name: "standard", entry: "apps/standard.jsx", title: "El Cabeza", files: DEN_RECORDS },
  { name: "futuris", entry: "apps/futuris.jsx", title: "Futuris Cabeza", files: SPHERE_FILES },
  { name: "cromo", entry: "apps/cromo.jsx", title: "Cromo Cabeza" },
  // Plano: the game drawn as a blueprint, its city alive round the board.
  { name: "plano", entry: "apps/plano.jsx", title: "Plano Cabeza", head: '<meta name="theme-color" content="#1D4C8A">' },
  // Luna: the game as a moon base, the board part of the lunar surface.
  { name: "luna", entry: "apps/luna.jsx", title: "Luna Cabeza", head: '<meta name="theme-color" content="#05070B">' },
  // Ciudad: the game in the city of the glass towers and cranes, at the
  // time of day the player picks (not in the switcher until the user says).
  // Its city, recorded, one loop an hour (tools/ciudad_sounds.py), beside
  // the page and fetched as the hour's wanted, not in it.
  { name: "ciudad", entry: "apps/ciudad.jsx", title: "El Cabeza · The City", head: '<meta name="theme-color" content="#2F4458">', files: CIUDAD_FILES },
  // Noir: the game as a night in a film noir city (in the switcher since the
  // user's "Incorporate Noir into Theme Switcher now").
  { name: "noir", entry: "apps/noir.jsx", title: "Noir Cabeza", head: '<meta name="theme-color" content="#0B0B0C">', files: {
    "el-cabeza-noir-rain.mp3": "assets/noir/rain.mp3",
    "el-cabeza-noir-thunder-1.mp3": "assets/noir/thunder-1.mp3", "el-cabeza-noir-thunder-2.mp3": "assets/noir/thunder-2.mp3",
    "el-cabeza-noir-car-engine.mp3": "assets/noir/car-engine.mp3", "el-cabeza-noir-car-rev.mp3": "assets/noir/car-rev.mp3", "el-cabeza-noir-car-tyres.mp3": "assets/noir/car-tyres.mp3",
    "el-cabeza-noir-siren-1.mp3": "assets/noir/siren-1.mp3", "el-cabeza-noir-siren-2.mp3": "assets/noir/siren-2.mp3", "el-cabeza-noir-siren-3.mp3": "assets/noir/siren-3.mp3",
  } },
  { name: "lluvia", entry: "apps/lluvia.jsx", title: "Lluvia Cabeza", files: { "el-cabeza-lluvia-rain.mp3": "assets/lluvia/rain.mp3" } },
  // Parrish's piece sounds: the user's stabs, cut small (tools/parrish_stabs.py);
  // its intro and its close, the user's opening and end of "Orinoco Flow"
  // (each in a long hall, tools/parrish_bookends.py).
  { name: "parrish", entry: "apps/parrish.jsx", title: "Parrish Cabeza", head: '<meta name="theme-color" content="#0E1A3D">', files: { "el-cabeza-parrish-stabs.mp3": "assets/parrish/piece-stabs.mp3", "el-cabeza-parrish-intro.mp3": "assets/parrish/intro.mp3", "el-cabeza-parrish-outro.mp3": "assets/parrish/outro.mp3", "el-cabeza-parrish-hums.mp3": "assets/parrish/hums.mp3", "el-cabeza-parrish-soundtrack-orinoco.mp3": "assets/parrish/soundtrack-orinoco.mp3", "el-cabeza-parrish-na-seas.mp3": "assets/parrish/na-seas.mp3", "el-cabeza-parrish-evening.mp3": "assets/parrish/evening.mp3" } },
  // Nova: the worlds it holds beside it (the City's chunk fetched as it's
  // picked); the City's sounds beside it too, for the City in place. It
  // opens on the title screen (apps/title-screen.js, in the page itself so
  // it's up before the app has loaded): the Horizon · Build splash
  // (tools/splash), sharp and light, and its first frame.
  { name: "nova", entry: "apps/unified.jsx", title: "El Cabeza Nova", viewport: "width=device-width,initial-scale=1,viewport-fit=cover",
    head: '<meta name="theme-color" content="#120C08">' + APP_HEAD + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400&display=swap">',
    bodyStart: "title",
    files: { ...DEN_RECORDS, ...CIUDAD_FILES, "el-cabeza-title.mp4": "assets/title/title.mp4", "el-cabeza-title-720.mp4": "assets/title/title-720.mp4", "el-cabeza-title-720.webm": "assets/title/title-720.webm", "el-cabeza-title-poster.jpg": "assets/title/poster.jpg", ...APP_FILES } },
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

/* Bundled once, shared by every page (identical AI code regardless of
   theme) — see engine/ai-worker.js's own header comment for why this is
   embedded as inert script text rather than shipped as a file of its
   own. Plain JS, no JSX loader needed. */
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

/* Nova's title screen, as a plain script in the page (not a module: it
   runs as the page is read, ahead of the app), the worlds' names written
   into it for its "Continue in ...". */
const titleJs = (await esbuild.transform(
  readFileSync("apps/title-screen.js", "utf8").replace("__WORLD_NAMES__", JSON.stringify(Object.fromEntries(WORLDS.map((w) => [w.id, w.name])))),
  { minify: true, loader: "js" },
)).code.replace(/<\/script/gi, "<\\/script");
const BODY_START = { title: `<script>${titleJs}</script>` };

/* Every page's script from one run, the code the pages share in chunks
   beside them (user: "shrink the iOS download size"). Each world's page
   used to carry its own copy of three, React, the chassis and the engine
   (about 1.1 MB, twelve pages over: 19 MB of script, 7 MB zipped); built
   together they come to about 4 MB (2 MB zipped), the shared chunks
   (el-cabeza-chunk-*.js) fetched once and kept from world to world. Each
   page loads its own entry (el-cabeza-<name>-app.js) as a module and
   preloads the chunks that imports; Nova's City still comes only as it's
   picked (apps/unified.jsx LAZY, user: "consolidate everything into a
   single link"). So no page is a single file any more: the tests open
   file:// pages with Chromium's --allow-file-access-from-files for it. */
{
  const result = await esbuild.build({
    entryPoints: Object.fromEntries(targets.map((t) => [`el-cabeza-${t.name}-app`, t.entry])),
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    splitting: true,
    outdir: "dist",
    chunkNames: "el-cabeza-[name]-[hash]",
    // Pictures (assets/) are inlined as data: URLs, in the chunk of the
    // code that shows them.
    loader: { ".js": "jsx", ".mp3": "dataurl", ".jpg": "dataurl", ".webp": "dataurl" },
    // Every page minified (2026-10 audit): Nova's script went from 3.9 MB
    // to 2.5 MB (1.27 to 1.11 MB gzipped), less for a phone to download
    // and parse. The code's long comments are what it mostly sheds; no
    // code here depends on function or class names.
    // (EC_KEEP_NAMES=1 keeps the functions' names, for reading a profile.)
    ...(process.env.EC_KEEP_NAMES ? { minifyWhitespace: true, minifySyntax: true } : { minify: true }),
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
  const written = new Set();
  for (const f of result.outputFiles) {
    const name = f.path.split(/[\\/]/).pop();
    writeFileSync(`dist/${name}`, f.contents);
    written.add(name);
  }
  // (An earlier build's chunks, their names hashed, cleared away.)
  for (const f of readdirSync("dist")) if (/^el-cabeza-.*\.js$/.test(f) && !written.has(f)) rmSync(`dist/${f}`);
  const outs = result.metafile.outputs;
  const bytes = (name) => outs[`dist/${name}`].bytes;
  const kb = (n) => `${(n / 1024).toFixed(0)}kb`;
  // The chunks a script imports, and theirs (what's only import()ed
  // waits till it's asked for).
  const imported = (name, seen = new Set()) => {
    for (const imp of outs[`dist/${name}`].imports) {
      const n = imp.path.split("/").pop();
      if (imp.kind === "import-statement" && !seen.has(n)) { seen.add(n); imported(n, seen); }
    }
    return seen;
  };
  for (const t of targets) {
    const entry = `el-cabeza-${t.name}-app.js`;
    const chunks = [...imported(entry)];
    const preload = chunks.map((c) => `<link rel="modulepreload" href="${c}">`).join("");
    // type="application/x-ai-worker" (not a JS mimetype) keeps the browser
    // from ever trying to execute this inline — chassis/ElCabeza3D.jsx
    // reads its textContent and turns it into a real Worker via a Blob URL.
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="${t.viewport || "width=device-width,initial-scale=1"}">${t.head || ""}<meta name="robots" content="noindex, nofollow"><title>${t.title}</title>${preload}</head><body style="margin:0">${t.bodyStart ? BODY_START[t.bodyStart] : ""}<div id="root"></div><script type="application/x-ai-worker" id="ai-worker-src">${workerJsEscaped}</script><script type="module" src="${entry}"></script></body></html>`;
    writeFileSync(`dist/el-cabeza-${t.name}.html`, html);
    Object.entries({ ...COMMON_FILES, ...(t.files || {}) }).forEach(([to, from]) => copyFileSync(from, `dist/${to}`));
    const own = bytes(entry), shared = chunks.reduce((s, c) => s + bytes(c), 0);
    console.log(`built dist/el-cabeza-${t.name}.html (${kb(own + shared)} JS: its own ${kb(own)}, ${chunks.length} shared chunk(s) ${kb(shared)}; ${kb(workerJs.length)} worker)`);
  }
  console.log(`the pages' scripts together: ${kb([...written].reduce((s, n) => s + bytes(n), 0))} in ${written.size} files`);
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

/* Futuris was Neon until 2026-10-16 (user: "Change all "neon" references
   to "futuris""), published as el-cabeza-neon.html, and that link has been
   shared too: the same kind of page, forwarding to Futuris with any
   ?query or #hash. */
writeFileSync(
  "dist/el-cabeza-neon.html",
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Futuris Cabeza</title>
<meta http-equiv="refresh" content="0; url=el-cabeza-futuris.html">
<link rel="canonical" href="el-cabeza-futuris.html">
<script>location.replace("el-cabeza-futuris.html" + location.search + location.hash);</script>
</head><body style="background:#05070c;color:#eee;font-family:system-ui,sans-serif">
<p>This world is now <a href="el-cabeza-futuris.html" style="color:#4de8ff">Futuris</a>.</p>
</body></html>
`
);
console.log("built dist/el-cabeza-neon.html (redirect to Futuris)");

/* ---- the front page's versions (front/*.html; the pictures the pages
   use, assets/front/*.webp and *.svg, under dist/front/). Each version
   is a page of its own for review (front-N.html); the chosen one becomes
   the site's index.html. */
if (existsSync("front")) {
  mkdirSync("dist/front", { recursive: true });
  for (const f of readdirSync("assets/front")) if (/\.(webp|svg|json)$/.test(f)) copyFileSync(`assets/front/${f}`, `dist/front/${f}`);
  if (existsSync("front/review")) { mkdirSync("dist/front/review", { recursive: true }); for (const f of readdirSync("front/review")) if (f.endsWith(".jpg")) copyFileSync(`front/review/${f}`, `dist/front/review/${f}`); }
  let n = 0;
  for (const f of readdirSync("front")) {
    if (!/\.(html|css)$/.test(f)) continue;
    copyFileSync(`front/${f}`, `dist/${f}`);
    if (f.endsWith(".html")) n++;
  }
  console.log(`built the front page's ${n} page(s) (front/ -> dist/)`);
}
