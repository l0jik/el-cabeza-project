/* The pieces as model files (glTF binary, OBJ, STL), from the game's own
   geometry (tools/front/export-harness.js says what and at what scale).
   The project keeps no modelled files: this is how a .glb/.obj/.stl of a
   piece comes to be.

   node tools/export_pieces.mjs [outDir]   (default assets/models)

   Writes one <type>.glb, .obj and .stl per piece type (its first
   starting pose: every other pose is the same solid rolled over), a
   set.glb with all fifteen laid out on the board's squares in both
   woods, and manifest.json (the scale, each piece's cubes and extents).
   Needs the dev dependencies (esbuild, playwright) and the Chromium
   Playwright knows, as tools/front_pieces.mjs does. */
import * as esbuild from "esbuild";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PIECE_ORIENTATIONS } from "../engine/anomaly.js";
import { PIECE_META, SQUARE_SIZE, PIECE_SCALE, CABEZA_SCALE, DISC_DIAM, DISC_H } from "../engine/constants.js";
import { EDGE_RADIUS } from "../themes/wood-set.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "assets/models"));
const SCRATCH = path.join(process.env.TMPDIR || "/tmp", "el-cabeza-export-harness");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SCRATCH, { recursive: true });

const TYPES = Object.keys(PIECE_META);

// The set, laid out as the proof sheets show it: the boxes in one row,
// the odd shapes in the next, the two Cabezas last; a square between.
function setLayout() {
  const rows = [
    ["turrito", "flaco", "chato", "opa", "block1x3", "block2x3"],
    ["codo", "arcoChico", "arcoAlto", "arcoAncho"],
    ["rayo", "zeta", "hombro", "cruce"],
    ["cabeza", "cabeza"],
  ];
  const out = [];
  let row = 0;
  rows.forEach((types) => {
    let col = 0, deepest = 1;
    types.forEach((type, i) => {
      const o = PIECE_ORIENTATIONS[type][0];
      out.push({ type, pose: 0, col, row, mat: i % 2 ? "dark" : "light" });
      col += o.w + 1; deepest = Math.max(deepest, o.h);
    });
    row += deepest + 1;
  });
  return out;
}

async function main() {
  await esbuild.build({ entryPoints: [path.join(ROOT, "tools/front/export-harness.js")], bundle: true, format: "iife", outfile: path.join(SCRATCH, "export-harness.js"), loader: { ".js": "jsx" }, jsx: "automatic", logLevel: "warning", define: { "process.env.NODE_ENV": '"production"' } });
  fs.writeFileSync(path.join(SCRATCH, "export.html"), `<!doctype html><html><body style="margin:0"><canvas id="c"></canvas><script src="export-harness.js"></script></body></html>`);
  // The Chromium tools/front_pieces.mjs renders with, when it is there;
  // otherwise whichever Playwright installed.
  const chrome = process.env.EC_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const browser = await chromium.launch({ ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}), args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(`file://${SCRATCH}/export.html`);
  await page.waitForFunction(() => window.__EXPORT_READY__, null, { timeout: 30000 });

  const manifest = {
    units: "the game's world units: one board square is SQUARE_SIZE across; a piece's footprint fills PIECE_SCALE of each of its squares; its base sits on y = 0 and its footprint's centre at x = z = 0; y is up",
    SQUARE_SIZE, PIECE_SCALE, CABEZA_SCALE, DISC_DIAM, DISC_H, EDGE_RADIUS,
    cabeza: { diameter: DISC_DIAM * CABEZA_SCALE, thickness: DISC_H * CABEZA_SCALE },
    unitCube: PIECE_SCALE,
    pieces: {},
  };
  for (const type of TYPES) {
    const t0 = Date.now();
    const r = await page.evaluate((spec) => window.exportPiece(spec), { type, pose: 0, material: "light" });
    const glb = Buffer.from(r.glb, "base64"), stl = Buffer.from(r.stl, "base64");
    fs.writeFileSync(path.join(OUT, `${type}.glb`), glb);
    fs.writeFileSync(path.join(OUT, `${type}.obj`), r.obj);
    fs.writeFileSync(path.join(OUT, `${type}.stl`), stl);
    const o = PIECE_ORIENTATIONS[type][0];
    const extents = PIECE_META[type].shape === "disc"
      ? { x: DISC_DIAM * CABEZA_SCALE, y: DISC_H * CABEZA_SCALE, z: DISC_DIAM * CABEZA_SCALE }
      : { x: o.w * PIECE_SCALE, y: o.z * PIECE_SCALE, z: o.h * PIECE_SCALE };
    manifest.pieces[type] = { name: PIECE_META[type].name, shape: PIECE_META[type].shape, pose: r.dims, squares: { w: o.w, h: o.h, z: o.z }, extents, startingPoses: PIECE_ORIENTATIONS[type].length, files: [`${type}.glb`, `${type}.obj`, `${type}.stl`] };
    console.log(`${type}: glb ${Math.round(glb.length / 1024)} KB, obj ${Math.round(r.obj.length / 1024)} KB, stl ${Math.round(stl.length / 1024)} KB, ${Date.now() - t0} ms`);
  }
  const set = await page.evaluate((spec) => window.exportSet(spec), { pieces: setLayout() });
  const setBuf = Buffer.from(set.glb, "base64");
  fs.writeFileSync(path.join(OUT, "set.glb"), setBuf);
  console.log(`set.glb: ${Math.round(setBuf.length / 1024)} KB`);
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await browser.close();
  if (errs.length) { console.log("page errors:", errs.slice(0, 5).join(" | ")); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
