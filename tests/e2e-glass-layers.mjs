/* Futuris's glass pieces against a solid thing in front of them (themes/
   futuris.js: the depth twins, seenThroughCopy). User, of a black hole's
   orb on the square in front of a tall glass piece and a block, both
   painted over the orb: "These are not layered correctly."

   The see-through layer paints a piece wherever it lies behind the
   nearest thing at that pixel, so a piece shows through the glass in
   front of it; it took a solid orb in front for glass too. Now it paints
   only where the nearest thing is a piece.

   A black hole on the square in front of a 1x3 standing on its end, the
   camera low and square-on: the piece stands behind the orb's face (with
   no orb, those pixels are the piece's), and every pixel of the orb's face
   is the same with the piece behind it as with the piece taken away (the
   orb's solid, nothing painted over it). The other way round, a low block
   on the square in front of the orb: its glass drawn over the orb. And
   the see-through layer's own job, kept: a tall piece behind a low one
   seen through the low one's glass.

   node tests/e2e-glass-layers.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };

const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html");
await page.waitForTimeout(2500);
await openDockPanel(page);
await page.locator("button", { hasText: /Begin Game/ }).first().click();
await page.mouse.move(890, 450);
await page.waitForTimeout(2000);

const CABEZAS = [
  { id: "dark-cabeza", type: "cabeza", owner: "dark", row: 0, col: 0, w: 1, h: 1, z: 1 },
  { id: "light-cabeza", type: "cabeza", owner: "light", row: 9, col: 9, w: 1, h: 1, z: 1 },
];
const TALL = { id: "light-tall", type: "block1x3", owner: "light", w: 1, h: 1, z: 3 };
const LOW = { id: "light-low", type: "turrito", owner: "light", w: 1, h: 1, z: 1 };
const AWAY = { row: 0, col: 9 };
const HOLE = { row: 5, col: 4 };
async function set(pieces, holes) {
  await page.evaluate(([ps, hs]) => { window.__EC_TEST_SET_PIECES__(ps); window.__EC_TEST_SET_HOLES__(hs); }, [pieces, holes]);
  await page.waitForTimeout(700);
}
// The orb as built (the chassis's black hole: a sphere standing on its square), its middle in the scene.
const orbAt = () => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__();
  const s = t.holeGroup.children.find((o) => o.geometry && o.geometry.type === "SphereGeometry");
  if (!s) return null;
  s.updateWorldMatrix(true, false);
  const p = s.getWorldPosition(new s.position.constructor());
  return { x: p.x, y: p.y, z: p.z, r: s.geometry.parameters.radius };
});
// The orb's face, seen: a grid of pixels inside its outline (four fifths
// of its radius), drawn now and read straight off the canvas.
const facePixels = (orb) => page.evaluate((orb) => {
  const t = window.__EC_TEST_THREE__(), V = t.camera.position.constructor, el = t.renderer.domElement;
  const centre = new V(orb.x, orb.y, orb.z), right = new V(1, 0, 0).applyQuaternion(t.camera.quaternion).multiplyScalar(orb.r);
  const scr = (p) => { const q = p.clone().project(t.camera); return { x: ((q.x + 1) / 2) * el.clientWidth, y: ((1 - q.y) / 2) * el.clientHeight }; };
  const c = scr(centre), r = Math.abs(scr(centre.clone().add(right)).x - c.x) * 0.8, k = el.width / el.clientWidth;
  t.renderer.render(t.scene, t.camera);
  const cv = document.createElement("canvas");
  cv.width = el.width; cv.height = el.height;
  const g = cv.getContext("2d");
  g.drawImage(el, 0, 0);
  const px = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    if (i * i + j * j > 9) continue;
    const d = g.getImageData(Math.round((c.x + (i / 3) * r) * k), Math.round((c.y + (j / 3) * r) * k), 1, 1).data;
    px.push([d[0], d[1], d[2]]);
  }
  return { c, r, px };
}, orb);
const apart = (a, b, i) => Math.max(...a.px[i].map((v, ch) => Math.abs(v - b.px[i][ch])));
const worst = (a, b) => Math.max(...a.px.map((_, i) => apart(a, b, i)));
const changed = (a, b, by = 24) => a.px.filter((_, i) => apart(a, b, i) > by).length;

// The hole on (5, 4), the camera to its south (rows grow toward it), low, the board square-on.
await set([...CABEZAS, { ...TALL, ...AWAY }], [HOLE]);
// (The board square-on first: for Dark's turn it's turned half round, and
// the orb's place in the scene with it.)
await page.evaluate(() => window.__EC_TEST_CAM__({ theta: 0, snap: true }));
await page.waitForTimeout(500);
const orb = await orbAt();
check("the black hole's orb built", !!orb, JSON.stringify(orb));
await page.evaluate((o) => window.__EC_TEST_CAM__({ theta: 0, phi: 1.22, radius: 7.5, target: [o.x, 0.6, o.z], snap: true }), orb);
await page.waitForTimeout(500);

console.log("A black hole on the square in front of a 1x3 standing on its end");
await set([...CABEZAS, { ...TALL, row: 4, col: 4 }], [HOLE]);
const withPiece = await facePixels(orb);
await set([...CABEZAS, { ...TALL, ...AWAY }], [HOLE]);
const without = await facePixels(orb);
await set([...CABEZAS, { ...TALL, row: 4, col: 4 }], []);
const pieceBare = await facePixels(orb);
await set([...CABEZAS, { ...TALL, ...AWAY }], []);
const boardBare = await facePixels(orb);
const behind = changed(pieceBare, boardBare);
check(`the piece stands behind the orb's face (${behind} of its ${pieceBare.px.length} pixels the piece's, with no orb there)`, behind >= 8, JSON.stringify({ c: withPiece.c, r: withPiece.r }));
const w = worst(withPiece, without);
check(`the orb's face the same with the piece behind it as without it (${w} apart at most, over ${withPiece.px.length} pixels): solid, nothing painted over it`, w <= 6, JSON.stringify({ with: withPiece.px.slice(0, 8), without: without.px.slice(0, 8) }));

console.log("A low block on the square in front of the orb");
await set([...CABEZAS, { ...LOW, row: 6, col: 4 }], [HOLE]);
const glassOver = await facePixels(orb);
const over = changed(glassOver, without);
check(`its glass drawn over the orb (${over} of the orb's pixels changed by it)`, over >= 6, JSON.stringify({ glass: glassOver.px.slice(0, 6), orb: without.px.slice(0, 6) }));

console.log("Glass behind glass, still seen through it");
// (The see-through layer's own job, kept: a tall piece behind a low one,
// seen through the low one's glass.)
const pieceAt = (id) => page.evaluate((i) => {
  const t = window.__EC_TEST_THREE__(), m = t.pieceGroup.children.find((c) => c.userData.pieceId === i && c.userData.kind === "piece");
  if (!m) return null;
  const p = m.getWorldPosition(new m.position.constructor());
  return { x: p.x, y: p.y, z: p.z, r: 0.3 };
}, id);
await set([...CABEZAS, { ...LOW, row: 6, col: 4 }, { ...TALL, row: 5, col: 4 }], []);
const low = await pieceAt("light-low");
const throughWith = await facePixels(low);
await set([...CABEZAS, { ...LOW, row: 6, col: 4 }, { ...TALL, ...AWAY }], []);
const throughWithout = await facePixels(low);
// (dimmed by the glass in front: a smaller change)
const seen = changed(throughWith, throughWithout, 10);
check(`a tall piece behind a low one: seen through the low one's glass (${seen} of its ${throughWith.px.length} pixels changed by it)`, seen >= 6, JSON.stringify({ with: throughWith.px.slice(0, 6), without: throughWithout.px.slice(0, 6) }));
check("no page errors", !errs.length, errs.slice(0, 3).join(" | "));
await browser.close();
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
