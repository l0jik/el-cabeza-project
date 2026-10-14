/* The front page's pictures of the game's pieces (tools/front/harness.js
   says why: the game's own shapes, scale, wood and board). Bundles the
   harness, renders each composition headless, writes assets/front/*.png
   (clear backgrounds) and the piece silhouettes assets/front/sil-*.svg
   (front and top elevations from the same cube lists).

     node tools/front_pieces.mjs [name ...]      (all, or the named ones) */
import * as esbuild from "esbuild";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { PIECE_ORIENTATIONS } from "../engine/anomaly.js";
import { initialPiecesFor } from "../engine/rules.js";
import { DISC_DIAM, DISC_H, CABEZA_SCALE, PIECE_SCALE } from "../engine/constants.js";

const ROOT = "/home/user/el-cabeza-project";
const OUT = path.join(ROOT, "assets/front");
const SCRATCH = "/tmp/claude-0/-home-user-el-cabeza-project/0d61cb35-f338-5a51-8fed-704904af3b2e/scratchpad/front-harness";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SCRATCH, { recursive: true });

/* ---------------------------------------------------------- the compositions */

// A pose by what it looks like, so the lists below read.
const P = {
  turrito: 0, cabeza: 0, opa: 0,
  flacoLying: 0, flacoAcross: 1, flacoUp: 2,
  chatoUp: 0, chatoAcross: 1, chatoFlat: 2,
  b13Lying: 0, b13Across: 1, b13Up: 2,
  b23Lying: 0, b23Across: 1, b23Up: 2,
  codoUp: 0, codoUpEnd: 1, codoFlat: 4,
  arcoChicoUp: 0, arcoChicoFlat: 1, arcoAltoUp: 0, arcoAnchoUp: 0, arcoAnchoFlat: 1,
  rayoUp: 0, rayoFlat: 2, zetaUp: 0, hombro: 0, cruceFlat: 0, cruceUp: 2,
};
const pc = (type, pose, col, row, mat, extra = {}) => ({ type, pose, col, row, mat, ...extra });

export const COMPOSITIONS = {
  // The tile wall of the user's reference, as the game's pieces lying on
  // a slab seen from straight above: light and dark wood, the two
  // Cabezas in brass and black lacquer.
  "flatlay": {
    size: [2000, 3000], dpr: 1, camera: { kind: "top", pad: 1.05 }, ground: 0.42, light: { keyDir: [-0.7, 1, 0.35] },
    pieces: [
      pc("arcoChico", P.arcoChicoFlat, 0, 0, "light"),
      pc("flaco", P.flacoLying, 3, 0, "dark"),
      pc("cabeza", 0, 4, 0, "brass"),
      pc("turrito", 0, 5, 0, "light"),
      pc("opa", 0, 4, 1, "dark"),
      pc("block1x3", P.b13Lying, 0, 2, "dark"),
      pc("chato", P.chatoFlat, 1, 2, "light"),
      pc("turrito", 0, 3, 2, "dark"),
      pc("codo", P.codoFlat, 3, 3, "light"),
      pc("cabeza", 0, 5, 3, "black"),
      pc("turrito", 0, 2, 4, "light"),
      pc("block2x3", P.b23Lying, 4, 5, "light"),
      pc("cruce", P.cruceFlat, 0, 5, "dark"),
      pc("hombro", P.hombro, 2, 6, "light"),
      pc("rayo", P.rayoFlat, 0, 7, "light"),
      pc("turrito", 0, 3, 8, "brass"),
      pc("flaco", P.flacoAcross, 4, 8, "dark"),
      pc("arcoAncho", P.arcoAnchoFlat, 0, 9, "dark"),
      pc("chato", P.chatoAcross, 4, 9, "light"),
      pc("cabeza", 0, 5, 10, "light"),
      pc("zeta", P.zetaUp, 1, 11, "dark"),
      pc("turrito", 0, 4, 10, "dark"),
    ],
  },
  // The pieces as a cluster, three-quarters on: the Arco Alto with a
  // Turrito standing in its opening (it fits: the arch has no cube there).
  "cluster": {
    size: [2200, 1500], dpr: 1, camera: { kind: "persp", az: 0.75, el: 0.46, fov: 26, pad: 1.05 }, ground: 0.4,
    pieces: [
      pc("arcoAlto", P.arcoAltoUp, 0, 2, "light"),
      pc("turrito", 0, 1, 2, "dark"),
      pc("opa", 0, 4, 0, "dark"),
      pc("flaco", P.flacoUp, 3, 3, "light"),
      pc("codo", P.codoUp, 4, 3, "dark"),
      pc("cabeza", 0, 2, 4, "light"),
      pc("chato", P.chatoUp, 6, 2, "light"),
      pc("hombro", P.hombro, 0, 4, "dark"),
      pc("cabeza", 0, 6, 0, "dark"),
    ],
  },
  "iso": {
    size: [1800, 1500], dpr: 1, camera: { kind: "ortho", pad: 1.06 }, ground: 0.4,
    pieces: [
      pc("opa", 0, 1, 1, "light"),
      pc("flaco", P.flacoUp, 3, 1, "dark"),
      pc("turrito", 0, 3, 2, "light"),
      pc("codo", P.codoUp, 0, 3, "dark"),
      pc("block1x3", P.b13Up, 4, 0, "light"),
      pc("cabeza", 0, 2, 3, "dark"),
      pc("chato", P.chatoUp, 3, 3, "light"),
      pc("hombro", P.hombro, 4, 2, "dark"),
    ],
  },
  "cluster-brass": {
    size: [2200, 1500], dpr: 1, camera: { kind: "persp", az: 0.75, el: 0.46, fov: 26, pad: 1.05 }, ground: 0.5,
    pieces: [
      pc("arcoAlto", P.arcoAltoUp, 0, 2, "black"),
      pc("turrito", 0, 1, 2, "brass"),
      pc("opa", 0, 4, 0, "black"),
      pc("flaco", P.flacoUp, 3, 3, "brass"),
      pc("codo", P.codoUp, 4, 3, "black"),
      pc("cabeza", 0, 2, 4, "brass"),
      pc("chato", P.chatoUp, 6, 2, "black"),
      pc("hombro", P.hombro, 0, 4, "brass"),
      pc("cabeza", 0, 6, 0, "black"),
    ],
  },
  // The two smallest, side by side, for the mark: a Turrito and a Flaco
  // standing (a cube and a 1:1:2 block), in both woods and in black and brass.
  "pair": { size: [1400, 1100], dpr: 1, camera: { kind: "persp", az: 0.55, el: 0.3, fov: 24, pad: 1.1 }, ground: 0.35, pieces: [pc("turrito", 0, 0, 0, "light"), pc("flaco", P.flacoUp, 1, 0, "dark")] },
  "pair-brass": { size: [1400, 1100], dpr: 1, camera: { kind: "persp", az: 0.55, el: 0.3, fov: 24, pad: 1.1 }, ground: 0.45, pieces: [pc("turrito", 0, 0, 0, "brass"), pc("flaco", P.flacoUp, 1, 0, "black")] },
  "pair-stone": { size: [1400, 1100], dpr: 1, camera: { kind: "persp", az: 0.55, el: 0.3, fov: 24, pad: 1.1 }, ground: 0.4, pieces: [pc("turrito", 0, 0, 0, "stone"), pc("flaco", P.flacoUp, 1, 0, "dark")] },
  // The Arco Chico sheltering a Turrito (the opening holds what fits).
  "arch": { size: [1600, 1100], dpr: 1, camera: { kind: "persp", az: 0.5, el: 0.28, fov: 24, pad: 1.1 }, ground: 0.35, pieces: [pc("arcoChico", P.arcoChicoUp, 0, 0, "light"), pc("turrito", 0, 1, 0, "dark")] },
  "arch-brass": { size: [1600, 1100], dpr: 1, camera: { kind: "persp", az: 0.5, el: 0.28, fov: 24, pad: 1.1 }, ground: 0.45, pieces: [pc("arcoChico", P.arcoChicoUp, 0, 0, "black"), pc("turrito", 0, 1, 0, "brass")] },
  // Every piece type in a row, three-quarters on, the woods alternating.
  "lineup": {
    size: [3600, 800], dpr: 1, camera: { kind: "ortho", az: 0.32, el: 0.36, pad: 1.03 }, ground: 0.35,
    pieces: (() => {
      const row = [["cabeza", 0], ["turrito", 0], ["flaco", P.flacoUp], ["chato", P.chatoUp], ["opa", 0], ["block1x3", P.b13Up], ["block2x3", P.b23Up], ["codo", P.codoUp], ["arcoChico", P.arcoChicoUp], ["arcoAlto", P.arcoAltoUp], ["arcoAncho", P.arcoAnchoUp], ["rayo", P.rayoUp], ["zeta", P.zetaUp], ["hombro", P.hombro], ["cruce", P.cruceUp]];
      let col = 0; const out = [];
      row.forEach(([t, pose], i) => { const o = PIECE_ORIENTATIONS[t][pose]; out.push(pc(t, pose, col, 0, i % 2 ? "dark" : "light")); col += o.w + 1; });
      return out;
    })(),
  },
  // The game as it begins: the standard opening on the folding board, from above and a little in front.
  "opening": {
    size: [2200, 2000], dpr: 1, camera: { kind: "persp", az: 0, el: 1.05, fov: 24, pad: 1.0 }, board: true,
    pieces: initialPiecesFor(10, 10).map((p) => ({ type: p.type, pose: { w: p.w, h: p.h, z: p.z }, col: p.col, row: p.row, mat: p.owner === "dark" ? "dark" : "light", id: p.id })),
  },
  "opening-top": {
    size: [2000, 2000], dpr: 1, camera: { kind: "top", pad: 1.0 }, board: true, light: { keyDir: [-0.5, 1, 0.6] },
    pieces: initialPiecesFor(10, 10).map((p) => ({ type: p.type, pose: { w: p.w, h: p.h, z: p.z }, col: p.col, row: p.row, mat: p.owner === "dark" ? "dark" : "light", id: p.id })),
  },
  // NOVA in the pieces, lying on the slab, from above (user: "one of the S
  // shape or Z shape pieces on its side at an angle. That would make an N.
  // A cabeza for the O. The elbow piece at resting on its corner. That
  // would be a V, and then the A could be any of the arches ... with its
  // open side pointing down"): the Rayo lying as an S turned on its side
  // (a pose it rolls into), the Cabeza, the Codo set down corner-first,
  // the Arco Alto rolled flat with its bar away from you.
  "nova-wood": {
    size: [2400, 900], dpr: 1, camera: { kind: "top", pad: 1.04 }, ground: 0.4, light: { keyDir: [-0.6, 1, 0.45] },
    pieces: [
      pc("rayo", { w: 2, h: 3, z: 1, vox: "0,0,0;0,1,0;1,1,0;1,2,0" }, 0, 0, "dark"),
      pc("cabeza", 0, 3, 1, "light", { lift: 0 }),
      pc("codo", { w: 2, h: 2, z: 1, vox: "0,0,0;0,1,0;1,1,0" }, 5, 0.5, "dark", { rot: 45 }),
      pc("arcoAlto", { w: 3, h: 3, z: 1, vox: "0,0,0;1,0,0;2,0,0;0,1,0;0,2,0;2,1,0;2,2,0" }, 8, 0, "light"),
    ],
  },
  "nova-brass": {
    size: [2400, 900], dpr: 1, camera: { kind: "top", pad: 1.04 }, ground: 0.5, light: { keyDir: [-0.6, 1, 0.45] },
    pieces: [
      pc("rayo", { w: 2, h: 3, z: 1, vox: "0,0,0;0,1,0;1,1,0;1,2,0" }, 0, 0, "black"),
      pc("cabeza", 0, 3, 1, "brass"),
      pc("codo", { w: 2, h: 2, z: 1, vox: "0,0,0;0,1,0;1,1,0" }, 5, 0.5, "black", { rot: 45 }),
      pc("arcoAlto", { w: 3, h: 3, z: 1, vox: "0,0,0;1,0,0;2,0,0;0,1,0;0,2,0;2,1,0;2,2,0" }, 8, 0, "brass"),
    ],
  },
  // The standing pieces in a row, seen from their row's side and low, in wood (the sunset's skyline, real).
  "skyline-wood": {
    size: [3600, 700], dpr: 1, camera: { kind: "ortho", az: 0.0, el: 0.1, pad: 1.02 }, ground: 0.3, light: { keyDir: [-0.3, 1, 0.8] },
    pieces: (() => {
      const row = [["arcoAlto", P.arcoAltoUp], ["flaco", P.flacoUp], ["turrito", 0], ["block1x3", P.b13Up], ["opa", 0], ["codo", P.codoUp], ["zeta", P.zetaUp], ["chato", P.chatoAcross], ["cruce", P.cruceUp], ["rayo", P.rayoUp], ["arcoChico", P.arcoChicoUp], ["hombro", P.hombro], ["arcoAncho", P.arcoAnchoUp]];
      let col = 0; const out = [];
      row.forEach(([t, pose], i) => { const o = PIECE_ORIENTATIONS[t][pose]; out.push(pc(t, pose, col, 0, i % 2 ? "light" : "dark")); col += o.w + 1; });
      return out;
    })(),
  },
  "skyline-short": {
    size: [2400, 700], dpr: 1, camera: { kind: "ortho", az: 0.0, el: 0.1, pad: 1.02 }, ground: 0.3, light: { keyDir: [-0.3, 1, 0.8] },
    pieces: (() => {
      const row = [["arcoAlto", P.arcoAltoUp], ["flaco", P.flacoUp], ["turrito", 0], ["opa", 0], ["codo", P.codoUp], ["zeta", P.zetaUp], ["chato", P.chatoAcross], ["arcoChico", P.arcoChicoUp]];
      let col = 0; const out = [];
      row.forEach(([t, pose], i) => { const o = PIECE_ORIENTATIONS[t][pose]; out.push(pc(t, pose, col, 0, i % 2 ? "light" : "dark")); col += o.w + 1; });
      return out;
    })(),
  },
  // The Cabeza alone, from above, each wood: the disc the marks are drawn from.
  "cabeza-dark": { size: [1000, 1000], dpr: 1, camera: { kind: "top", pad: 1.15 }, ground: 0.3, pieces: [pc("cabeza", 0, 0, 0, "dark")] },
  "cabeza-light": { size: [1000, 1000], dpr: 1, camera: { kind: "top", pad: 1.15 }, ground: 0.3, pieces: [pc("cabeza", 0, 0, 0, "light")] },
  "cabeza-side": { size: [1400, 700], dpr: 1, camera: { kind: "persp", az: 0.35, el: 0.22, fov: 20, pad: 1.1 }, ground: 0.35, pieces: [pc("cabeza", 0, 0, 0, "dark"), pc("cabeza", 0, 2, 0, "light")] },
};

/* ---------------------------------------------------------- the silhouettes */

/* Front elevation (what stands on the board, seen from its row's side)
   and plan (from above) of a pose, as an SVG path of unit squares: the
   cube lists themselves, nothing drawn by hand. The disc is its real
   diameter and thickness in the same unit. */
function silhouette(type, pose, view) {
  if (type === "cabeza") {
    const d = DISC_DIAM * CABEZA_SCALE, t = DISC_H * CABEZA_SCALE;
    if (view === "top") return { w: d, h: d, body: `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}"/>` };
    return { w: d, h: t, body: `<rect x="0" y="0" width="${d}" height="${t}" rx="${t * 0.12}"/>` };
  }
  const o = PIECE_ORIENTATIONS[type][pose];
  const cubes = o.vox ? o.vox.split(";").map((s) => s.split(",").map(Number)) : (() => { const out = []; for (let x = 0; x < o.w; x++) for (let y = 0; y < o.h; y++) for (let l = 0; l < o.z; l++) out.push([x, y, l]); return out; })();
  const s = PIECE_SCALE; // a piece fills PIECE_SCALE of each square
  const seen = new Set(); let body = "";
  if (view === "top") {
    cubes.forEach(([x, y]) => { const k = `${x},${y}`; if (seen.has(k)) return; seen.add(k); body += `<rect x="${x}" y="${y}" width="1.002" height="1.002"/>`; });
    return { w: o.w, h: o.h, body, scale: s };
  }
  cubes.forEach(([x, , l]) => { const k = `${x},${l}`; if (seen.has(k)) return; seen.add(k); body += `<rect x="${x}" y="${o.z - 1 - l}" width="1.002" height="1.002"/>`; });
  return { w: o.w, h: o.z, body, scale: s };
}
const SILS = [
  ["turrito", 0], ["flaco", P.flacoUp], ["flaco", P.flacoAcross], ["chato", P.chatoUp], ["chato", P.chatoAcross], ["opa", 0],
  ["block1x3", P.b13Up], ["block1x3", P.b13Across], ["block2x3", P.b23Up], ["block2x3", P.b23Across],
  ["codo", P.codoUp], ["codo", P.codoFlat], ["arcoChico", P.arcoChicoUp], ["arcoAlto", P.arcoAltoUp], ["arcoAncho", P.arcoAnchoUp],
  ["rayo", P.rayoUp], ["rayo", P.rayoFlat], ["zeta", P.zetaUp], ["hombro", P.hombro], ["cruce", P.cruceUp], ["cruce", P.cruceFlat], ["cabeza", 0],
];
function writeSilhouettes() {
  const index = {};
  for (const [type, pose] of SILS) {
    for (const view of ["front", "top"]) {
      const s = silhouette(type, pose, view);
      const name = `sil-${type}-${pose}-${view}`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.w} ${s.h}" width="${s.w * 100}" height="${s.h * 100}"><g fill="currentColor" shape-rendering="crispEdges">${s.body}</g></svg>\n`;
      fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
      index[name] = { w: s.w, h: s.h, body: s.body };
    }
  }
  fs.writeFileSync(path.join(OUT, "silhouettes.json"), JSON.stringify(index));
}

/* ---------------------------------------------------------- the renders */

async function main() {
  writeSilhouettes();
  const only = process.argv.slice(2);
  const names = Object.keys(COMPOSITIONS).filter((n) => !only.length || only.includes(n));
  await esbuild.build({ entryPoints: [path.join(ROOT, "tools/front/harness.js")], bundle: true, format: "iife", outfile: path.join(SCRATCH, "harness.js"), loader: { ".js": "jsx" }, jsx: "automatic", logLevel: "warning", define: { "process.env.NODE_ENV": '"production"' } });
  fs.writeFileSync(path.join(SCRATCH, "harness.html"), `<!doctype html><html><body style="margin:0;background:#888"><canvas id="c"></canvas><script src="harness.js"></script></body></html>`);
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(`file://${SCRATCH}/harness.html`);
  await page.waitForFunction(() => window.__FRONT_READY__, null, { timeout: 30000 });
  for (const name of names) {
    const t0 = Date.now();
    const url = await page.evaluate((spec) => window.renderFront(spec), COMPOSITIONS[name]);
    const buf = Buffer.from(url.split(",")[1], "base64");
    fs.writeFileSync(path.join(OUT, `${name}.png`), buf);
    console.log(`${name}: ${Math.round(buf.length / 1024)} KB, ${Date.now() - t0} ms`);
  }
  await browser.close();
  if (errs.length) { console.log("page errors:", errs.slice(0, 5).join(" | ")); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
