/* The Theme Lab's Monolith, in Bauhaus's place (user: "we're getting rid
   of Bauhaus and replacing it with something imposing & neolithic
   monoliths"; "I want the sound palette to be non-synthesizer generated.
   I want real massive: thud / boom / scraping sounds ... per weight
   dictating pitch"; "the blocks, themselves need to be rough-hewn, not
   perfect looking"). themes/lab: specs.js, monoliths.js, hewn.js,
   monolith-sounds.js and audio.js's monolith voice.

   The weight rules and the recordings' layout, then the page, served over
   http (as GitHub Pages serves it: a page opened from disk can't fetch the
   recordings beside it):
   - the land: sky, moon, plain, the board's shelf, the stones, their
     shadows, rubble, and the fog; no stone or rubble inside the box the
     camera is kept in, above its floor (no view is ever inside a stone);
   - the pieces hewn: no face flat, every corner knocked off, nothing past
     its own squares; and a piece that rolls keeps its own shape (its
     chips come down where they went over);
   - its recordings fetched (the Opus twins) and decoded;
   - a landing pitched by its face and its weight, louder the heavier; a
     roll's grind lower for a heavier piece; the Cabeza's slide a grind
     held, nothing struck;
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
import { landingRate, landingLevel, dragRate, HIT_COUNT, HIT_SLOT, FALLS, FALLS_LENGTH, DRAGS, DRAGS_LENGTH, XFADE } from "../themes/lab/monolith-sounds.js";
import { LAB_SPECS } from "../themes/lab/specs.js";

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

console.log("the weight rules");
{
  check("a single cube lands at 1.2, an Opa flat at 0.6: within an octave", Math.abs(landingRate(1, 1) - 1.2) < 1e-9 && Math.abs(landingRate(8, 4) - 0.6) < 1e-9);
  check("on its end a Flaco lands higher than on its side (the face)", landingRate(2, 1) > landingRate(2, 2) * 1.15);
  check("heavier, lower: one cube, two, four, eight", landingRate(1, 1) > landingRate(2, 2) && landingRate(2, 2) > landingRate(4, 4) && landingRate(4, 4) > landingRate(8, 4));
  check("heavier, louder: 0.55 for a cube to 1 for eight", Math.abs(landingLevel(1) - 0.55) < 1e-9 && Math.abs(landingLevel(8) - 1) < 1e-9 && landingLevel(2) < landingLevel(4));
  check("a heavier piece grinds lower", dragRate(8) < dragRate(2) && dragRate(2) < dragRate(1));
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
  const land = await poll(() => page.evaluate(() => {
    const t = window.__EC_TEST_THREE__();
    const g = t && t.scene.getObjectByName("lab-monolith-land");
    if (!g) return null;
    g.updateMatrixWorld(true);
    const has = Object.fromEntries(["monolith-sky", "monolith-moon", "monolith-plain", "monolith-shelf", "monolith-stones", "monolith-shadows"].map((n) => [n, !!g.getObjectByName(n)]));
    // Every point of every stone and every piece of rubble, where it
    // stands: inside the camera's box (specs.js camera.freeCamera.room,
    // x and z within 24, two more to spare) none above its floor (0.9).
    let points = 0, inRoom = 0, stoneMeshes = 0, rubble = 0;
    const at = (e, x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
    const look = (e, a) => { for (let i = 0; i < a.length; i += 3) { const [x, y, z] = at(e, a[i], a[i + 1], a[i + 2]); points++; if (Math.abs(x) <= 26 && Math.abs(z) <= 26 && y >= 0.9) inRoom++; } };
    g.getObjectByName("monolith-stones").traverse((o) => { if (o.isMesh) { stoneMeshes++; look(o.matrixWorld.elements, o.geometry.attributes.position.array); } });
    g.traverse((o) => {
      if (!o.isInstancedMesh) return;
      rubble += o.count;
      const m = o.instanceMatrix.array, w = o.matrixWorld.elements, a = o.geometry.attributes.position.array;
      for (let k = 0; k < o.count; k++) {
        const e = m.slice(k * 16, k * 16 + 16);
        const c = (i, j) => w[i] * e[j] + w[i + 4] * e[j + 1] + w[i + 8] * e[j + 2] + w[i + 12] * e[j + 3]; // (world x instance)
        const E = [];
        for (let j = 0; j < 16; j += 4) E.push(c(0, j), c(1, j), c(2, j), c(3, j));
        look(E, a);
      }
    });
    const f = t.scene.fog;
    const sky = g.getObjectByName("monolith-sky");
    return { has, stoneMeshes, rubble, points, inRoom, fog: f ? { isFog: !!f.isFog, near: f.near, far: f.far } : null, skyFogless: sky && sky.material.fog === false };
  }), 20000);
  check("the land: sky, moon, plain, the board's shelf, the stones, their shadows", !!land && Object.values(land.has).every(Boolean), JSON.stringify(land && land.has));
  check(`...rubble over the plain (${land && land.rubble})`, !!land && land.rubble >= 100);
  check("...and the fog the plain runs out into (the sky never fogged)", !!land && !!land.fog && land.fog.isFog && land.fog.near >= 30 && land.fog.far > land.fog.near && land.skyFogless, JSON.stringify(land && land.fog));
  check(`no stone or rubble inside the camera's box above its floor (${land && land.points} points looked at)`, !!land && land.points > 1000 && land.inRoom === 0, land && `${land.inRoom} inside`);

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

  const notes = await page.evaluate(() => window.__EC_TEST_MONOLITH__);
  const sounds = await page.evaluate(() => window.__EC_TEST_MOVE_SOUNDS__);
  const lands = notes.filter((n) => n.part === "land");
  const onEnd = lands.find((n) => n.units === 2 && n.contact === 1), onSide = lands.find((n) => n.units === 2 && n.contact === 2), flat = lands.find((n) => n.units === 8);
  console.log("   landings:", JSON.stringify(lands.map((n) => ({ u: n.units, c: n.contact, rate: +n.rate.toFixed(3), level: +n.level.toFixed(3) }))));
  check("the Flaco on its end lands higher than back on its side", !!onEnd && !!onSide && onEnd.rate > onSide.rate);
  check("the Opa (eight cubes) lands lowest and loudest", !!flat && !!onSide && flat.rate < onSide.rate * 0.8 && flat.level > onSide.level, JSON.stringify({ flat, onSide }));
  const rolls = notes.filter((n) => n.part === "drag" && n.swell === "rise");
  const r2 = rolls.find((n) => n.units === 2), r8 = rolls.find((n) => n.units === 8);
  check("a roll grinds as it tips, the Opa's lower than the Flaco's", !!r2 && !!r8 && r8.rate < r2.rate, JSON.stringify(rolls));
  const cabSounds = sounds.filter((s) => s.id === cabeza);
  check("the Cabeza's slide: a grind held for the glide, nothing struck", cabSounds.some((s) => s.kind === "slide" && s.played) && !cabSounds.some((s) => s.kind === "landing" || s.kind === "rollStart") && notes.some((n) => n.part === "drag" && n.swell === "hold"), JSON.stringify(cabSounds));

  // ---- the About card
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "about" } })));
  const credits = await poll(() => page.evaluate(() => { const e = document.querySelector('[data-testid="info-sound-credits"]'); return e && e.innerText; }), 8000);
  check("the About card credits the recordings", !!credits && /freesound\.org/.test(credits) && /CC0/.test(credits) && /vestibule-door/.test(credits) && /Tim_Verberne/.test(credits), credits || "");
  check("no page errors", errs.length === 0, errs.slice(0, 4).join(" | "));
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
