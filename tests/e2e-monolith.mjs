/* The Theme Lab's Monolith, in Bauhaus's place (user: "we're getting rid
   of Bauhaus and replacing it with something imposing & neolithic
   monoliths"; "I want the sound palette to be non-synthesizer generated.
   I want real massive: thud / boom / scraping sounds ... per weight
   dictating pitch"; "the blocks, themselves need to be rough-hewn, not
   perfect looking"). themes/lab: specs.js, monoliths.js, rockforms.js,
   hewn.js, monolith-sounds.js and audio.js's monolith voice.

   The weight rules and the recordings' layout, then the page, served over
   http (as GitHub Pages serves it: a page opened from disk can't fetch the
   recordings beside it):
   - the land (user: "when you rotate the board the entire 3D world
     rotates"; "the board to be chiseled into the surface of the ground";
     "make sure that all the different shapes of the pieces, including
     Cabeza Nova, are represented"): it hangs on the board group, so it
     turns with the board, and the lights turn with it; sky, moon, ground,
     rock, its shadows, rubble, the fog; every piece's shape standing in
     it (a computer's: on both sides), rock of other kinds between; the
     board a part of the ground (user: "Make the board a seamless part of
     the ground"): the chassis's slab, outline and grid gone, the
     plateau's floor level under the board and its bench, the grid
     chiseled in; no ground, plate, rock or rubble inside the room the
     camera is kept in, above its floor (no view is ever inside a stone);
   - the pieces hewn: no face flat, every corner knocked off, nothing past
     its own squares; and a piece that rolls keeps its own shape (its
     chips come down where they went over);
   - its recordings fetched (the Opus twins) and decoded;
   - a landing pitched by its face and its weight, harder the heavier
     and the further it fell going over (user: "These are massive
     monolithic stones slamming down ... they need to be weighted
     appropriately as they fall"); a roll silent till it lands (user:
     "Rolling should not make a slide sound"); the Cabeza's slide a grind
     held, nothing struck;
   - the move markers: the hearth (the dressed margin, a subdued
     firelight on it), and each of the five it was chosen from with
     ?marker= (monolith-markers.js);
   - the About card credits the recordings;
   - an old link to Bauhaus, or Bauhaus saved as the last choice, opens
     the Monolith;
   - no page errors.
   node tests/e2e-monolith.mjs */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDockPanel } from "./dock-helpers.mjs";
import { landingRate, landingLevel, landingDepth, fallOf, slamOf, dragRate, HIT_COUNT, HIT_SLOT, FALLS, FALLS_LENGTH, DRAGS, DRAGS_LENGTH, XFADE } from "../themes/lab/monolith-sounds.js";
import { rollDrop } from "../engine/shapes.js";
import { LAB_SPECS } from "../themes/lab/specs.js";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const near = (a, b) => typeof a === "number" && Math.abs(a - b) < 0.005;
const poll = async (fn, ms = 8000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

console.log("the weight rules");
{
  check("every stone lands lower than the recording: a single cube at 0.86, an Opa flat at 0.51, within an octave", Math.abs(landingRate(1, 1) - 0.86) < 1e-9 && Math.abs(landingRate(8, 4) - 0.86 / Math.pow(8, 0.25)) < 1e-9 && landingRate(8, 4) / landingRate(1, 1) > 0.5);
  check("on its end a Flaco lands higher than on its side (the face)", landingRate(2, 1) > landingRate(2, 2) * 1.15);
  check("heavier, lower: one cube, two, four, eight", landingRate(1, 1) > landingRate(2, 2) && landingRate(2, 2) > landingRate(4, 4) && landingRate(4, 4) > landingRate(8, 4));
  check("deeper, by the face and the piece: none for a cube, all for an Opa flat", Math.abs(landingDepth(1, 1)) < 1e-9 && Math.abs(landingDepth(8, 4) - 1) < 1e-9 && landingDepth(2, 1) < landingDepth(2, 2));
  check("how far a stone falls going over: a cube 0.21, a Flaco off its end 0.62, onto it 0.12, an Opa 0.41", near(fallOf(1, 1), 0.207) && near(fallOf(2, 1), 0.618) && near(fallOf(1, 2), 0.118) && near(fallOf(2, 2), 0.414));
  check("...the chassis's the same (rollDrop: its height before and after)", near(rollDrop({ z: 2 }, { z: 1 }), fallOf(2, 1)) && near(rollDrop({ z: 1 }, { z: 2 }), fallOf(1, 2)));
  check("how hard it lands, its cubes times its fall: a Turrito's roll least, an Opa's most", slamOf(1, fallOf(1, 1)) < 0.05 && Math.abs(slamOf(8, fallOf(2, 2)) - 1) < 0.01);
  check("...a Flaco tipped off its end harder than stood up onto it; a Chato laid flat harder than a Flaco", slamOf(2, fallOf(2, 1)) > slamOf(2, fallOf(1, 2)) + 0.4 && slamOf(4, fallOf(2, 1)) > slamOf(2, fallOf(2, 1)));
  check("louder by it: 0.6 a cube rolled over to 1 an Opa", Math.abs(landingLevel(1, fallOf(1, 1)) - 0.6) < 0.01 && Math.abs(landingLevel(8, fallOf(2, 2)) - 1) < 0.01 && landingLevel(2, fallOf(1, 2)) < landingLevel(2, fallOf(2, 1)));
  check("a heavier piece grinds lower (a slide)", dragRate(8) < dragRate(2) && dragRate(2) < dragRate(1));
}
console.log("the recordings' layout");
{
  const parts = Object.values(FALLS).sort((a, b) => a[0] - b[0]);
  check("the falls end to end, inside their file", parts.every(([at, len], i) => at >= 0 && len > 0 && (i === 0 || at >= parts[i - 1][0] + parts[i - 1][1] - 1e-9)) && parts.at(-1)[0] + parts.at(-1)[1] <= FALLS_LENGTH + 1e-9);
  check("each drag's loop inside its stretch, room for its crossfade before it", Object.values(DRAGS).every((d) => d.loop[0] - XFADE >= d.at && d.loop[1] <= d.at + d.len && d.at + d.len <= DRAGS_LENGTH + 1e-9));
  check("a slot for every hit", HIT_COUNT >= 11 && HIT_SLOT >= 1);
}
console.log("the spec");
{
  const s = LAB_SPECS.find((x) => x.id === "monolith");
  check("the Monolith is the Lab's second direction, Bauhaus gone", !!s && LAB_SPECS[1] === s && s.num === "02" && !LAB_SPECS.some((x) => x.id === "bauhaus"));
  check("its pieces hewn, its slides gliding, its sound the stone's, credited", !!s && s.pieces.hewn === true && s.slidesGlide === true && s.audio === "monolith" && /freesound\.org/.test(s.soundCredits || ""));
}

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp3": "audio/mpeg", ".opus": "audio/ogg", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });

// The land as it stands, once built (every formation in): what's in it,
// where, and whether any of it is inside the camera's room.
const landOf = (pg) => poll(() => pg.evaluate(() => {
  const t = window.__EC_TEST_THREE__ && window.__EC_TEST_THREE__();
  const g = t && t.scene.getObjectByName("lab-monolith-land");
  if (!g || !g.userData.ready) return null;
  const has = Object.fromEntries(["monolith-sky", "monolith-moon", "monolith-ground", "monolith-plates", "monolith-grid", "monolith-rocks", "monolith-shadows", "monolith-rubble"].map((n) => [n, !!g.getObjectByName(n)]));
  // Every point of the ground, the rock and the rubble, in the land's own
  // frame (the board's, which the camera's room turns with): inside the
  // room (specs.js camera.freeCamera.room, x and z within 24, two more to
  // spare) none above its floor (0.9).
  let points = 0, inRoom = 0;
  const look = (e, a) => {
    for (let i = 0; i < a.length; i += 3) {
      const x = e[0] * a[i] + e[4] * a[i + 1] + e[8] * a[i + 2] + e[12], y = e[1] * a[i] + e[5] * a[i + 1] + e[9] * a[i + 2] + e[13], z = e[2] * a[i] + e[6] * a[i + 1] + e[10] * a[i + 2] + e[14];
      points++;
      if (Math.abs(x) <= 26 && Math.abs(z) <= 26 && y >= 0.9) inRoom++;
    }
  };
  for (const o of g.children) {
    if (!o.isMesh || /sky|moon|shadows/.test(o.name)) continue;
    const a = o.geometry.attributes.position.array;
    if (o.isInstancedMesh) {
      const m = o.instanceMatrix.array;
      for (let k = 0; k < o.count; k++) look(m.slice(k * 16, k * 16 + 16), a);
    } else look(o.matrix.elements, a);
  }
  // The board a part of the ground (user: "Make the board a seamless part
  // of the ground"): the chassis's slab, its outline and its grid gone; the
  // plateau's floor level at 0 under the board and its bench (nothing of
  // the plates above it there), the floor's own edge further out; the
  // grid chiseled in over the board.
  const slab = t.boardGroup.getObjectByName("ec-slab");
  const hx = slab.geometry.parameters.width / 2, hz = slab.geometry.parameters.depth / 2;
  const pp = g.getObjectByName("monolith-plates").geometry.attributes.position.array;
  let floorPts = 0, overFloor = 0;
  for (let i = 0; i < pp.length; i += 3) {
    const x = pp[i], y = pp[i + 1], z = pp[i + 2];
    if (Math.abs(x) > hx + 0.5 || Math.abs(z) > hz + 3.2 || y < -0.02) continue;
    if (Math.abs(y) < 1e-5) floorPts++; else overFloor++;
  }
  const gm = g.getObjectByName("monolith-grid"), gw = gm.geometry.parameters;
  const grid = { w: gw.width, d: gw.height, y: gm.position.y, flat: Math.abs(gm.rotation.x + Math.PI / 2) < 1e-6, map: !!gm.material.map };
  const F = g.userData.formations, types = {};
  F.filter((f) => f.type).forEach((f) => { (types[f.type] = types[f.type] || []).push(f.side); });
  const f = t.scene.fog, sky = g.getObjectByName("monolith-sky");
  const gone = ["ec-slab", "ec-slab-edges", "ec-top-ring", "ec-grid"].map((n) => t.boardGroup.getObjectByName(n)).filter(Boolean);
  return {
    onBoard: g.parent === t.boardGroup, has, points, inRoom, types, kinds: [...new Set(F.filter((x) => x.kind !== "piece").map((x) => x.kind))],
    formations: F.length, floorPts, overFloor, grid, gridSize: [hx * 2, hz * 2], slabGone: gone.length === 4 && gone.every((o) => !o.visible),
    fog: f ? { isFog: !!f.isFog, near: f.near, far: f.far } : null, skyFogless: !!sky && sky.material.fog === false, stats: g.userData.stats,
  };
}), 120000, 500);
const SHAPES = ["cabeza", "turrito", "opa", "flaco", "chato", "block1x3", "block2x3", "codo", "arcoChico", "arcoAlto", "arcoAncho", "rayo", "zeta", "hombro", "cruce"];
function landChecks(land, where, { bothSides = false } = {}) {
  check(`${where}: the land hangs on the board group (it turns with the board)`, !!land && land.onBoard);
  check(`${where}: sky, moon, ground, rock, its shadows, rubble`, !!land && Object.values(land.has).every(Boolean), JSON.stringify(land && land.has));
  check(`${where}: every piece's shape stands in the land, the standard five and Cabeza Nova's ten${bothSides ? ", on both sides" : ""}`, !!land && SHAPES.every((s) => land.types[s] && (!bothSides || (land.types[s].includes("light") && land.types[s].includes("dark")))), JSON.stringify(land && land.types));
  check(`${where}: and rock of other kinds between (${land && land.kinds.join(", ")})`, !!land && land.kinds.length >= (bothSides ? 9 : 6));
  check(`${where}: the board a part of the ground: the slab, its outline and its grid gone`, !!land && land.slabGone);
  check(`${where}: ...the plateau's floor level under the board and its bench (${land && land.floorPts} points at 0, ${land && land.overFloor} above)`, !!land && land.floorPts >= 20 && land.overFloor === 0);
  check(`${where}: ...the grid chiseled into it, over the whole board (${land && JSON.stringify(land.grid)})`, !!land && land.grid.map && land.grid.flat && land.grid.y > 0 && land.grid.y < 0.01 && land.grid.w >= land.gridSize[0] - 1 && land.grid.d >= land.gridSize[1] - 1);
  check(`${where}: the fog the land runs out into (the sky never fogged)`, !!land && !!land.fog && land.fog.isFog && land.fog.near >= 30 && land.fog.far > land.fog.near && land.skyFogless, JSON.stringify(land && land.fog));
  check(`${where}: no ground, rock or rubble inside the camera's room above its floor (${land && land.points} points looked at)`, !!land && land.points > 10000 && land.inRoom === 0, land && `${land.inRoom} inside`);
  if (land) console.log(`   ${where}: ${land.formations} formations, built in ${Math.round(land.stats.buildMs)} ms, ${land.stats.vertices} points of rock`);
}

console.log("the page");
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.setDefaultTimeout(30000);
  const errs = [], fetched = {};
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_CONNECTION|fonts\.g/.test(m.text())) errs.push(m.text()); });
  page.on("response", (r) => { const m = /el-cabeza-monolith-([a-z]+)\.(mp3|opus)/.exec(r.url()); if (m) fetched[`${m[1]}.${m[2]}`] = r.status(); });
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_TEST_MONOLITH__ = []; window.__EC_TEST_MOVE_SOUNDS__ = []; try { localStorage.removeItem("el-cabeza:lab-theme"); } catch (e) { /* none */ } });
  await page.goto(`${BASE}/el-cabeza-lab.html?theme=monolith`);
  check("the Lab opens on the Monolith", !!(await poll(() => page.evaluate(() => !!window.__LAB__ && window.__LAB__.id === "monolith" && !!document.querySelector('[data-testid="lab-hud"]') && !!window.__EC_TEST_THREE__), 30000)));

  // ---- the land
  const land = await landOf(page);
  landChecks(land, "here");
  // Turned: the land goes round with the board, the moon's and the dusk's
  // light with it (a shadow stays where it falls).
  await page.evaluate(() => window.__EC_TEST_CAM__({ theta: 1.3, snap: true }));
  const turned = await poll(() => page.evaluate(() => {
    const t = window.__EC_TEST_THREE__(), g = t.scene.getObjectByName("lab-monolith-land"), b = g && g.userData.lightBase;
    const a = t.boardGroup.rotation.y;
    if (!b || Math.abs(a + 1.3) > 1e-3) return null;
    const rot = (v) => [v.x * Math.cos(a) + v.z * Math.sin(a), v.y, -v.x * Math.sin(a) + v.z * Math.cos(a)];
    const off = (l, v) => { const e = rot(v); return Math.hypot(l.position.x - e[0], l.position.y - e[1], l.position.z - e[2]); };
    return { a, onBoard: g.parent === t.boardGroup, key: off(t.lights.key, b.key), fill: off(t.lights.fill, b.fill), back: off(t.lights.back, b.back) };
  }), 10000);
  check("turned, the land goes round with the board, and the lights with it", !!turned && turned.onBoard && turned.key < 1e-3 && turned.fill < 1e-3 && turned.back < 1e-3, JSON.stringify(turned));
  await page.evaluate(() => window.__EC_TEST_CAM__({ theta: 0, snap: true }));
  await page.waitForTimeout(500);

  // ---- the pieces, hewn
  const PIECE_SCALE = 0.87;
  const pieceShapes = () => page.evaluate((S) => {
    const t = window.__EC_TEST_THREE__();
    const out = {};
    t.pieceGroup.children.forEach((o) => {
      if (!o.userData || o.userData.kind !== "piece") return;
      const p = window.__EC_TEST_PIECES__.find((q) => q.id === o.userData.pieceId);
      if (!p) return;
      const a = o.geometry.attributes.position.array;
      // (A rotation-free signature of the shape: each point's distance from
      // the middle, sorted; a stone turned over keeps it.)
      let cx = 0, cy = 0, cz = 0;
      const n = a.length / 3;
      for (let i = 0; i < a.length; i += 3) { cx += a[i]; cy += a[i + 1]; cz += a[i + 2]; }
      cx /= n; cy /= n; cz /= n;
      const ds = [];
      let past = 0;
      const half = p.type === "cabeza" ? null : [p.w * S / 2, p.z * S / 2, p.h * S / 2];
      for (let i = 0; i < a.length; i += 3) {
        ds.push(Math.hypot(a[i] - cx, a[i + 1] - cy, a[i + 2] - cz));
        if (half && [0, 1, 2].some((k) => Math.abs(a[i + k]) > half[k] + 1e-5)) past++;
      }
      ds.sort((x, y) => x - y);
      // Each face's middle (its middle third or so, clear of the edges'
      // knocks): how far its points stand from one another across it, in
      // from the face. A sawn face: nothing.
      const spread = [];
      if (half) for (let k = 0; k < 3; k++) for (const sg of [-1, 1]) {
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < a.length; i += 3) {
          const o1 = (k + 1) % 3, o2 = (k + 2) % 3;
          if (a[i + k] * sg < half[k] * 0.5 || Math.abs(a[i + o1]) > half[o1] * 0.4 || Math.abs(a[i + o2]) > half[o2] * 0.4) continue;
          lo = Math.min(lo, a[i + k] * sg); hi = Math.max(hi, a[i + k] * sg);
        }
        if (hi >= lo) spread.push(hi - lo);
      }
      // How near any point comes to each corner of its square box.
      let corner = Infinity;
      if (half) for (let c = 0; c < 8; c++) {
        const cc = [c & 1 ? half[0] : -half[0], c & 2 ? half[1] : -half[1], c & 4 ? half[2] : -half[2]];
        let best = Infinity;
        for (let i = 0; i < a.length; i += 3) best = Math.min(best, Math.hypot(a[i] - cc[0], a[i + 1] - cc[1], a[i + 2] - cc[2]));
        corner = Math.min(corner, best);
      }
      out[p.id] = { type: p.type, n, faceSpread: spread.length ? spread.reduce((x, y) => x + y, 0) / spread.length : 0, faces: spread.length, past, corner, sig: ds.filter((_, i) => i % 7 === 0).map((d) => +d.toFixed(4)) };
    });
    return out;
  }, PIECE_SCALE);
  const shapes = await pieceShapes();
  const blocks = Object.values(shapes).filter((s) => s.type !== "cabeza");
  check(`ten pieces, each built (${Object.keys(shapes).length})`, Object.keys(shapes).length === 10);
  check("every block's faces uneven: each face's middle wanders in and out", blocks.length === 8 && blocks.every((s) => s.faces === 6 && s.faceSpread > 0.005), JSON.stringify(blocks.map((s) => +s.faceSpread.toFixed(4))));
  check("every block's corners knocked off", blocks.every((s) => s.corner > 0.02), JSON.stringify(blocks.map((s) => +s.corner.toFixed(3))));
  check("nothing of a block past its own squares", blocks.every((s) => s.past === 0), JSON.stringify(blocks.map((s) => s.past)));
  // Rough cut (user: "The pieces on the board must be more rough cut than they currently are"): shaded flat, facet
  // by facet, every one a stone of its own; and the Cabeza bare (user: "Remove the spirals off of the cabeza pieces").
  const cut = await page.evaluate(() => {
    const t = window.__EC_TEST_THREE__();
    const meshes = t.pieceGroup.children.filter((c) => c.userData.kind === "piece");
    const cabezas = meshes.filter((m) => /cabeza/.test(m.userData.pieceId));
    return {
      n: meshes.length, flat: meshes.filter((m) => m.material.flatShading).length, colours: meshes.filter((m) => !!m.geometry.attributes.color && !!m.geometry.attributes.stonePos).length,
      cabezas: cabezas.length, marks: cabezas.reduce((k, m) => k + m.children.filter((c) => c.userData.kind === "mark").length, 0),
    };
  });
  check(`every piece a rough-cut stone, shaded facet by facet, its own colours (${JSON.stringify(cut)})`, cut.n === 10 && cut.flat === 10 && cut.colours === 10);
  check("the Cabezas bare: no spiral", cut.cabezas === 2 && cut.marks === 0, JSON.stringify(cut));

  // ---- a game: the recordings, and the stones' weight in their sound
  await page.mouse.click(5, 400); // (a gesture)
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).first().click();
  await page.mouse.move(1096, 380);
  await page.waitForTimeout(2200);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(550, 756); await page.waitForTimeout(500); }
  const loaded = await poll(() => page.evaluate(() => (window.__EC_TEST_MONOLITH__ || []).find((n) => n.part === "loaded")), 15000);
  check("its recordings fetched and decoded, all three", !!loaded && loaded.hits && loaded.falls && loaded.drags, JSON.stringify(loaded));
  check("...the Opus twins, where the browser plays Opus", ["hits", "falls", "drags"].every((k) => fetched[`${k}.opus`] === 200), JSON.stringify(fetched));

  // ---- the move markers: the hearth, the dressed margin with a subdued
  // firelight (user, of five offered: "Let's do dressed margin with a
  // subdued firelight."), and each of the five, tried with ?marker= on the
  // page
  const markersOf = () => page.evaluate(() => {
    const out = [];
    window.__EC_TEST_THREE__().scene.traverse((o) => {
      if (!o.userData || o.userData.kind !== "ghostLine" || o.userData.fadingOut) return;
      const m = { meshes: 0, points: 0, lit: 0, carved: 0, glow: 0, shaft: 0, sheet: 0, k: 0 };
      o.traverse((q) => {
        if (q.material && q.material.userData) m.k = Math.max(m.k, q.material.userData.k ?? 1);
        if (q.isPoints) { m.points++; return; }
        if (!q.isMesh) return;
        m.meshes++;
        if (q.material.isMeshStandardMaterial) m.lit++;
        if (q.material.normalMap) m.carved++;
        if (q.material.blending === 2) m.glow++;
        if (q.geometry && q.geometry.type === "CylinderGeometry") m.shaft++;
        if (q.geometry && q.geometry.type === "PlaneGeometry") m.sheet++;
      });
      out.push(m);
    });
    return out;
  });
  const LOOKS = {
    // (Drawn at three quarters, user: "Dim the move markers on monolith by 25%.")
    hearth: (m) => m.lit === 1 && m.carved === 1 && m.glow === 1 && m.points === 1 && m.sheet === 2 && Math.abs(m.k - 0.75) < 1e-6,
    cupring: (m) => m.lit === 1 && m.carved === 1 && !m.points,
    hand: (m) => m.lit === 1 && m.sheet === 1 && !m.carved && !m.points && !m.glow,
    fire: (m) => !m.lit && m.glow === 1 && m.points === 1,
    beam: (m) => !m.lit && m.glow === 2 && m.shaft === 1 && m.points === 1,
    margin: (m) => m.lit === 1 && m.carved === 1 && !m.points,
  };
  // (At the game's start: mid-turn a tap can't put the chosen piece down.
  // The Turrito out in the open, where it can go four ways; the board put
  // back after.)
  const startPieces = await page.evaluate(() => window.__EC_TEST_PIECES__.map((p) => ({ ...p })));
  const chooser = `${await page.evaluate(() => window.__EC_TEST_TO_MOVE__())}-turrito`;
  await page.evaluate(([ps, id]) => window.__EC_TEST_SET_PIECES__(ps.map((p) => (p.id === id ? { ...p, row: 4, col: 4 } : p))), [startPieces, chooser]);
  await page.waitForTimeout(800);
  // (A tap on the chosen piece puts it down; another picks it up, its
  // markers built again, as the kind the page now asks for.)
  const tapChooser = async () => { const at = await page.evaluate((i) => window.__EC_TEST_SCREEN_POS__(i), chooser); if (at) await page.mouse.click(at.x, at.y); };
  // (Put down by a tap on an empty square well away from it: the chosen
  // piece's card may stand over the piece itself.)
  const tapAway = async () => { const at = await page.evaluate(() => window.__EC_TEST_SQUARE_POS__(5, 0)); if (at) await page.mouse.click(at.x, at.y); };
  for (const kind of Object.keys(LOOKS)) {
    await page.evaluate((k) => { const u = new URL(location.href); if (k === "hearth") u.searchParams.delete("marker"); else u.searchParams.set("marker", k); history.replaceState(null, "", u.toString()); }, kind);
    if ((await markersOf()).length) { await tapAway(); await poll(async () => ((await markersOf()).length ? null : true), 4000, 150); }
    await tapChooser();
    const seen = await poll(async () => { const list = await markersOf(); return list.length && list.every(LOOKS[kind]) ? list : null; }, 8000, 200);
    check(`the move markers, ${kind}${kind === "hearth" ? " (the spec's: the margin, the firelight subdued on it)" : ""}: one on each landing, as it should look`, !!seen && seen.length >= 2, JSON.stringify(seen || (await markersOf())));
  }
  if ((await markersOf()).length) await tapAway();
  await page.evaluate(() => { const u = new URL(location.href); u.searchParams.delete("marker"); history.replaceState(null, "", u.toString()); });
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), startPieces);
  await page.waitForTimeout(800);

  // (No capture's ring at a move: a piece its roll carries off isn't
  // taken; user, of the ring that came up in the board's middle at every
  // move: "Whenever any piece move, this ring shows up. Why does it do
  // that? I don't think I like it." Any ring but the chosen piece's, its
  // opacity fixed, is a burst.)
  await page.evaluate(() => {
    window.__EC_RINGS__ = [];
    const fx = window.__EC_TEST_THREE__().scene.getObjectByName("lab-monolith-fx");
    const look = () => {
      if (!window.__EC_RINGS__) return;
      if (fx) fx.traverse((o) => {
        if (!o.isMesh || !o.geometry || o.geometry.type !== "RingGeometry") return;
        let shown = true;
        for (let q = o; q; q = q.parent) if (!q.visible) shown = false;
        const op = o.material.opacity;
        if (shown && Math.abs(op - 0.95) > 0.01 && Math.abs(op - 0.95 * 0.45) > 0.01) { const w = o.getWorldPosition(new o.position.constructor()); window.__EC_RINGS__.push([+w.x.toFixed(2), +w.z.toFixed(2), +op.toFixed(2)]); }
      });
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  const toMove = () => page.evaluate(() => window.__EC_TEST_TO_MOVE__());
  const pieceOf = (id) => page.evaluate((i) => JSON.stringify(window.__EC_TEST_PIECES__.find((p) => p.id === i) || null), id);
  // A step, then its landing and the piece built again where it came down.
  const step = async (id, dir) => {
    const before = await pieceOf(id);
    await page.evaluate(([i, d]) => window.__EC_TEST_MOVE__(i, d), [id, dir]);
    const moved = await poll(async () => (await pieceOf(id)) !== before, 15000, 150);
    await page.waitForTimeout(700);
    return !!moved;
  };
  const side = await toMove();
  const fwd = (s) => (s === "dark" ? "S" : "N");
  const flaco = `${side}-flaco`;
  const flacoShape0 = shapes[flaco];
  const rolled1 = await step(flaco, fwd(side));
  const flacoShape1 = (await pieceShapes())[flaco];
  const rolled2 = await step(flaco, fwd(side));
  check(`${flaco} rolled twice, onto its end and back down`, rolled1 && rolled2);
  // The same stone after it's gone over: the same distances from its
  // middle, the chips come down where they went over (built from scratch
  // in its own frame it would be another stone).
  const same = (a, b) => !!a && !!b && a.sig.length === b.sig.length && a.sig.every((d, i) => Math.abs(d - b.sig[i]) < 2e-3);
  check("a piece that rolls keeps its own hewn shape", same(flacoShape0, flacoShape1), flacoShape0 && flacoShape1 ? `${flacoShape0.sig.slice(-5)} / ${flacoShape1.sig.slice(-5)}` : "");
  const other = await poll(async () => { const s = await toMove(); return s !== side ? s : null; }, 10000);
  const opa = `${other}-opa`;
  const rolledOpa = await step(opa, fwd(other));
  check(`${opa} rolled`, rolledOpa);
  // The Cabeza slides, once its own Opa (in the square before it at the
  // start) has gone out of its way.
  let s = await toMove();
  if (s === side) { await step(`${side}-opa`, fwd(side)); s = await toMove(); }
  const cabeza = `${s}-cabeza`;
  const slid = await step(cabeza, fwd(s));
  check(`${cabeza} slid`, slid);
  await page.waitForTimeout(800);

  const bursts = await page.evaluate(() => { const r = window.__EC_RINGS__ || []; window.__EC_RINGS__ = null; return r; });
  check("no capture's ring at any of those moves (nothing was taken)", bursts.length === 0, JSON.stringify(bursts.slice(0, 6)));
  const notes = await page.evaluate(() => window.__EC_TEST_MONOLITH__);
  const sounds = await page.evaluate(() => window.__EC_TEST_MOVE_SOUNDS__);
  const lands = notes.filter((n) => n.part === "land");
  const onEnd = lands.find((n) => n.units === 2 && n.contact === 1), onSide = lands.find((n) => n.units === 2 && n.contact === 2), flat = lands.find((n) => n.units === 8);
  console.log("   landings:", JSON.stringify(lands.map((n) => ({ u: n.units, c: n.contact, fall: n.fall == null ? null : +n.fall.toFixed(3), rate: +n.rate.toFixed(3), level: +n.level.toFixed(3), slam: +n.slam.toFixed(3) }))));
  check("the Flaco on its end lands higher than back on its side", !!onEnd && !!onSide && onEnd.rate > onSide.rate);
  check("...stood up onto its end it fell little; tipped back off it, far, and lands harder", !!onEnd && !!onSide && near(onEnd.fall, fallOf(1, 2)) && near(onSide.fall, fallOf(2, 1)) && onSide.slam > onEnd.slam + 0.4 && onSide.level > onEnd.level, JSON.stringify({ onEnd, onSide }));
  check("the Opa (eight cubes) lands lowest and hardest", !!flat && !!onSide && flat.rate < onSide.rate * 0.85 && flat.level > onSide.level && flat.slam > 0.99, JSON.stringify({ flat, onSide }));
  const rollsAsked = sounds.filter((s) => s.kind === "rollStart").length;
  check("a roll silent till it lands: no grind as a stone tips", rollsAsked >= 3 && !notes.some((n) => n.part === "drag" && n.swell === "rise"), JSON.stringify({ rollsAsked, drags: notes.filter((n) => n.part === "drag") }));
  const cabSounds = sounds.filter((s) => s.id === cabeza);
  check("the Cabeza's slide: a grind held for the glide, nothing struck", cabSounds.some((s) => s.kind === "slide" && s.played) && !cabSounds.some((s) => s.kind === "landing" || s.kind === "rollStart") && notes.some((n) => n.part === "drag" && n.swell === "hold"), JSON.stringify(cabSounds));

  // ---- the About card
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "about" } })));
  const credits = await poll(() => page.evaluate(() => { const e = document.querySelector('[data-testid="info-sound-credits"]'); return e && e.innerText; }), 8000);
  check("the About card credits the recordings", !!credits && /freesound\.org/.test(credits) && /CC0/.test(credits) && /vestibule-door/.test(credits) && /Tim_Verberne/.test(credits), credits || "");
  check("no page errors", errs.length === 0, errs.slice(0, 4).join(" | "));
  await page.close();
}

console.log("a computer's land");
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto(`${BASE}/el-cabeza-lab.html?theme=monolith&quality=high`);
  landChecks(await landOf(page), "a computer's", { bothSides: true });
  check("a computer's: no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await page.close();
}

console.log("old ways to Bauhaus");
for (const [label, url, saved] of [["?theme=bauhaus", "el-cabeza-lab.html?theme=bauhaus", null], ["Bauhaus saved as the last choice", "el-cabeza-lab.html", "bauhaus"]]) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript((s) => { window.__EC_TEST_HOOKS__ = true; try { if (s) localStorage.setItem("el-cabeza:lab-theme", s); else localStorage.removeItem("el-cabeza:lab-theme"); } catch (e) { /* none */ } }, saved);
  await page.goto(`${BASE}/${url}`);
  const id = await poll(() => page.evaluate(() => window.__LAB__ && window.__LAB__.id), 30000);
  check(`${label}: the Monolith opens`, id === "monolith", String(id));
  check(`${label}: no page errors`, errs.length === 0, errs.slice(0, 3).join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} monolith check(s) failed` : "\nall monolith checks passed");
process.exit(fails ? 1 : 0);
