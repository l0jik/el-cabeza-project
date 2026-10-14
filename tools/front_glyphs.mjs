/* Inline SVG of the game's pieces for the front page's two flat
   compositions (front-6's skyline, front-10's NOVA): the same cube lists
   the rules use (engine/anomaly.js), scaled by one unit (--u) so every
   piece keeps its size against the others. Prints JSON {skyline, nova}.
     node tools/front_glyphs.mjs */
import { PIECE_ORIENTATIONS } from "../engine/anomaly.js";
import { DISC_DIAM, CABEZA_SCALE } from "../engine/constants.js";

const cubesOf = (o) => (o.vox ? o.vox.split(";").map((s) => s.split(",").map(Number)) : (() => { const out = []; for (let x = 0; x < o.w; x++) for (let y = 0; y < o.h; y++) for (let l = 0; l < o.z; l++) out.push([x, y, l]); return out; })());
// Front elevation (x across, levels up) or plan (x across, rows down), as unit squares.
// The O: the Cabeza drawn larger than its square (user: "make the cabeza
// larger in this image"), the one liberty the lettering takes.
const O_SCALE = 2.3;
function shape(type, pose, view, scale = 1) {
  if (type === "cabeza") { const d = DISC_DIAM * CABEZA_SCALE * scale; return { w: d, h: d, body: `<circle cx="${(d / 2).toFixed(3)}" cy="${(d / 2).toFixed(3)}" r="${(d / 2).toFixed(3)}"/>` }; }
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

// NOVA, in the pieces, as the user set it out ("one of the S shape or Z
// shape pieces on its side at an angle. That would make an N. A cabeza
// for the O. The elbow piece at resting on its corner. That would be a
// V, and then the A could be any of the arches ... with its open side
// pointing down"): the Rayo lying as an S on its side (two cubes high on
// the left, two low on the right), the Cabeza from above, the Codo (its
// two arms the same length) set on its corner, the Arco Alto with its
// opening down. The V is the only one turned off the square (-45deg), in
// its own box so the word sets on one baseline.
const vSil = shape("codo", { w: 2, h: 2, z: 1, vox: "0,0,0;0,1,0;1,1,0" }, "top");
const nova = [
  svg(shape("rayo", { w: 2, h: 3, z: 1, vox: "0,0,0;0,1,0;1,1,0;1,2,0" }, "top"), "g n", "N: a Rayo on its side"),
  svg(shape("cabeza", 0, "top", O_SCALE), "g o", "O: the Cabeza"),
  `<span class="g v" style="display:inline-block;width:calc(var(--u) * 2.83);height:calc(var(--u) * 2.12);position:relative" role="img" aria-label="V: a Codo on its corner"><svg viewBox="0 0 2 2" style="position:absolute;left:50%;top:0;width:calc(var(--u) * 2);height:calc(var(--u) * 2);transform:translate(-50%, calc(var(--u) * -0.3)) rotate(-45deg);transform-origin:50% 50%"><g shape-rendering="crispEdges">${vSil.body}</g></svg></span>`,
  svg(shape("arcoAlto", 0, "front"), "g a", "A: an Arco Alto, its opening down"),
].join("");
process.stdout.write(JSON.stringify({ skyline, nova }));
