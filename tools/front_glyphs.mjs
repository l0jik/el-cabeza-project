/* Inline SVG of the game's pieces for the front page's two flat
   compositions (front-6's skyline, front-10's NOVA): the same cube lists
   the rules use (engine/anomaly.js), scaled by one unit (--u) so every
   piece keeps its size against the others. Prints JSON {skyline, nova}.
     node tools/front_glyphs.mjs */
import { PIECE_ORIENTATIONS } from "../engine/anomaly.js";
import { DISC_DIAM, CABEZA_SCALE } from "../engine/constants.js";

const cubesOf = (o) => (o.vox ? o.vox.split(";").map((s) => s.split(",").map(Number)) : (() => { const out = []; for (let x = 0; x < o.w; x++) for (let y = 0; y < o.h; y++) for (let l = 0; l < o.z; l++) out.push([x, y, l]); return out; })());
// Front elevation (x across, levels up) or plan (x across, rows down), as unit squares.
function shape(type, pose, view) {
  if (type === "cabeza") { const d = DISC_DIAM * CABEZA_SCALE; return { w: d, h: d, body: `<circle cx="${(d / 2).toFixed(3)}" cy="${(d / 2).toFixed(3)}" r="${(d / 2).toFixed(3)}"/>` }; }
  const o = typeof pose === "object" ? pose : PIECE_ORIENTATIONS[type][pose];
  const seen = new Set(); let body = "";
  for (const [x, y, l] of cubesOf(o)) {
    const [cx, cy] = view === "top" ? [x, y] : [x, o.z - 1 - l];
    const k = `${cx},${cy}`; if (seen.has(k)) continue; seen.add(k);
    body += `<rect x="${cx}" y="${cy}" width="1.004" height="1.004"/>`;
  }
  return { w: o.w, h: view === "top" ? o.h : o.z, body };
}
const svg = (s, cls, title) => `<svg class="${cls}" viewBox="0 0 ${s.w} ${s.h}" style="width:calc(var(--u) * ${s.w});height:calc(var(--u) * ${s.h})" role="img" aria-label="${title}"><g shape-rendering="crispEdges">${s.body}</g></svg>`;

// The skyline: what stands on the board, seen from its row's side.
const SKY = [["arcoAlto", 0, "Arco Alto"], ["flaco", 2, "Flaco, standing"], ["turrito", 0, "Turrito"], ["block1x3", 2, "1×3, standing"], ["opa", 0, "Opa"], ["codo", 0, "Codo, standing"], ["zeta", 0, "Zeta"], ["chato", 1, "Chato, on edge"], ["cruce", 2, "Cruce, on its bar"], ["rayo", 0, "Rayo, standing"], ["arcoChico", 0, "Arco Chico"], ["hombro", 0, "Hombro"], ["arcoAncho", 0, "Arco Ancho"]];
const skyline = SKY.map(([t, p, n]) => svg(shape(t, p, "front"), "p", n)).join("");

// NOVA, in four pieces (user: "Nova can be spelled using the ones
// marked"): N a Rayo stood on end (its upright pose rolled over sideways,
// engine/shapes.js rollVox E: two cubes high on the left, two low on the
// right), O the Cabeza from above, V the Arco Alto lying flat with its
// opening up (a Roman V), A the Arco Alto standing (its opening the A's counter).
const nova = [
  svg(shape("rayo", { w: 2, h: 1, z: 3, vox: "0,0,1;0,0,2;1,0,0;1,0,1" }, "front"), "g n", "N: a Rayo on end"),
  svg(shape("cabeza", 0, "top"), "g o", "O: the Cabeza"),
  // (the Alto rolled over onto its side, engine/shapes.js rollVox S: the
  // same seven cubes lying flat, its bar at the bottom, so a U the height of the N and the A)
  svg(shape("arcoAlto", { w: 3, h: 3, z: 1, vox: "0,0,0;0,1,0;0,2,0;1,2,0;2,0,0;2,1,0;2,2,0" }, "top"), "g v", "V: an Arco Alto, flat"),
  svg(shape("arcoAlto", 0, "front"), "g a", "A: an Arco Alto, standing"),
].join("");
process.stdout.write(JSON.stringify({ skyline, nova }));
