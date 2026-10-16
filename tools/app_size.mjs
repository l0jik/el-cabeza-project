/* What a packaged app of the game (iOS, or Android with --android) would
   weigh: the files in dist/ it would ship, as installed and as downloaded
   (an .ipa or .apk is a zip, each file deflated on its own: zip -9 here). Leaves out what only the
   website needs: the front page's versions (front*, dist/front/), the old
   addresses' redirects (el-cabeza-unified.html, el-cabeza-neon.html), the
   site's index and robots.txt, and one of the den spot's two copies: for
   iOS the VP9 one (.webm; Safari plays the H.264 .mp4), for Android
   (--android) the H.264 one, the VP9 copy being the smaller and Android's
   WebView playing it (den-commercial.js lists both; a missing one is
   passed over). The app's own wrapper (a few MB) isn't counted.
     npm run build && node tools/app_size.mjs [--android] */
import { readdirSync, statSync, readFileSync } from "fs";
import { deflateRawSync, constants } from "zlib";

const DIST = new URL("../dist/", import.meta.url).pathname;
const android = process.argv.includes("--android");
const webOnly = (f) => f.startsWith("front") || ["el-cabeza-unified.html", "el-cabeza-neon.html", "index.html", "robots.txt"].includes(f) || f.endsWith(android ? ".mp4" : ".webm");
const files = readdirSync(DIST).filter((f) => statSync(DIST + f).isFile() && !webOnly(f));
const kinds = {};
let raw = 0, zipped = 0;
for (const f of files) {
  const bytes = readFileSync(DIST + f);
  // (Per file: its deflated size or, for what won't shrink, as stored;
  // and the zip's headers for it, about 100 bytes with the name twice.)
  const z = Math.min(deflateRawSync(bytes, { level: constants.Z_BEST_COMPRESSION }).length, bytes.length) + 76 + 2 * f.length;
  const k = (kinds[f.split(".").pop()] ||= { n: 0, raw: 0, zipped: 0 });
  k.n++; k.raw += bytes.length; k.zipped += z;
  raw += bytes.length; zipped += z;
}
const mb = (n) => (n / 1048576).toFixed(1).padStart(5);
console.log(`${android ? "Android" : "iOS"}: ${files.length} files, ${mb(raw)} MB of them, ${mb(zipped)} MB zipped (about the download)`);
for (const [ext, k] of Object.entries(kinds).sort((a, b) => b[1].raw - a[1].raw)) console.log(`  ${ext.padEnd(5)} ${String(k.n).padStart(3)} files ${mb(k.raw)} MB ${mb(k.zipped)} MB zipped`);
