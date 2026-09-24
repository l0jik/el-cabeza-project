/* The ANOMALY button re-shuffles the pieces THIS game has, not the
   classic five: with a Singularity-style roster on the board (two
   Cabezas, two Codos, an Arco Chico, a Turrito), a click must give back
   exactly those pieces — Codo/Arco cubes and all — in a fresh
   rotationally symmetric opening. A plain board still shuffles the
   classic five. Pieces are placed with the test-only hooks
   (window.__EC_TEST_HOOKS__, see chassis/ElCabeza3D.jsx). */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const FILE = "file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html";

const dark = [
  { id: "dark-cabeza", type: "cabeza", row: 0, col: 0, w: 1, h: 1, z: 1 },
  { id: "dark-cabeza-1", type: "cabeza", row: 0, col: 1, w: 1, h: 1, z: 1 },
  { id: "dark-codo", type: "codo", row: 0, col: 2, w: 2, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,0" },
  { id: "dark-codo-1", type: "codo", row: 0, col: 4, w: 2, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,0" },
  { id: "dark-arcoChico", type: "arcoChico", row: 1, col: 0, w: 3, h: 1, z: 2, vox: "0,0,0;0,0,1;1,0,1;2,0,0;2,0,1" },
  { id: "dark-turrito", type: "turrito", row: 1, col: 4, w: 1, h: 1, z: 2 },
];
const sig = (ps) => ps.map((p) => `${p.owner}:${p.type}:${p.vox ? "v" : "b"}`).sort().join(",");

const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/ERR_CERT|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
await page.goto(FILE);
await page.waitForTimeout(1500);
await openDockPanel(page);
const anomaly = page.locator("button", { hasText: /^Anomaly$/i }).first();

// ---- a plain board: still the classic five ----
await anomaly.click();
await page.waitForTimeout(300);
let pieces = await page.evaluate(() => window.__EC_TEST_PIECES__);
check("a plain board shuffles the classic five per side",
  sig(pieces) === sig(["cabeza", "chato", "flaco", "opa", "turrito"].flatMap((type) => [{ owner: "dark", type }, { owner: "light", type }])),
  sig(pieces));

// ---- a custom roster: the same pieces come back, shuffled ----
const before = await page.evaluate((d) => {
  // Board size from the classic opening Anomaly just placed (Light's
  // back row is the bottom edge). Mirror Dark through the centre.
  const ps = window.__EC_TEST_PIECES__;
  const R = Math.max(...ps.map((p) => p.row + p.h));
  const C = Math.max(...ps.map((p) => p.col + p.w));
  const light = d.map((p) => {
    const q = { ...p, id: p.id.replace("dark", "light"), owner: "light", row: R - p.row - p.h, col: C - p.col - p.w };
    if (p.vox) q.vox = p.vox.split(";").map((s) => { const [x, y, l] = s.split(",").map(Number); return [p.w - 1 - x, p.h - 1 - y, l].join(","); }).sort().join(";");
    return q;
  });
  const all = [...d.map((p) => ({ ...p, owner: "dark" })), ...light];
  window.__EC_TEST_SET_PIECES__(all);
  return all;
}, dark);
await page.waitForTimeout(300);
let moved = false;
for (let i = 0; i < 3 && !moved; i++) {
  await anomaly.click();
  await page.waitForTimeout(300);
  pieces = await page.evaluate(() => window.__EC_TEST_PIECES__);
  moved = pieces.some((p) => { const b = before.find((q) => q.id === p.id); return !b || b.row !== p.row || b.col !== p.col || (b.vox || "") !== (p.vox || ""); });
}
check("Anomaly keeps this game's pieces (Cabezas x2, Codos x2, Arco Chico, Turrito)", sig(pieces) === sig(before), `${sig(pieces)}`);
check("the same piece ids come back", pieces.map((p) => p.id).sort().join() === before.map((p) => p.id).sort().join());
check("and they're re-shuffled", moved);
const R = Math.max(...pieces.map((p) => p.row + p.h));
check("Dark's pieces sit in its two home rows", pieces.filter((p) => p.owner === "dark").every((p) => p.row + p.h <= 2), JSON.stringify(pieces.filter((p) => p.owner === "dark")));
check("Light's are Dark's 180-degree mirror", pieces.filter((p) => p.owner === "dark").every((d) => {
  const l = pieces.find((p) => p.id === d.id.replace("dark", "light"));
  return l && l.row === R - d.row - d.h && l.w === d.w && l.h === d.h && l.z === d.z;
}));
check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
console.log(failures === 0 ? "\nANOMALY E2E PASSED" : `\nANOMALY E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
