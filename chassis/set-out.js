/* Place pieces manually, in the chassis (user: "a toggle(?) / way to manually
   place pieces before the start of a match"; of the five ways mocked up
   they picked dragging a piece on the board, or tapping it then a square;
   the back three rows, or anywhere in your own half; two players mirrored
   as the computer is; and "Same as last time"). The rules are
   engine/placement.js; this is what ElCabeza3D.jsx keeps between games,
   where the bench stands, what's drawn on the board while you set out,
   and the words the banner says.

   The board's marks are the chassis's own, the same in every world (as
   the check alert's are): the rows you may use outlined, a dot on every
   square the chosen piece fits, the squares it would land on while it's
   dragged, and the bench, a tray in front of your edge of the board. */
import * as THREE from "three";
import { SQUARE_SIZE, OFF_X, OFF_Z, SLAB_X, SLAB_Z, PIECE_META } from "../engine/constants.js";
import { zoneRows, targets } from "../engine/placement.js";
import { piecesClash } from "../engine/shapes.js";

/* ---- kept between games ------------------------------------------------ */
// Standard, or Manual: the setup's Starting position. Standard unless chosen.
const START_KEY = "el-cabeza:start-position";
export function loadStartByHand() {
  try { return window.localStorage.getItem(START_KEY) === "hand"; } catch (e) { return false; }
}
export function saveStartByHand(on) {
  try { window.localStorage.setItem(START_KEY, on ? "hand" : "standard"); } catch (e) { /* storage unavailable */ }
}
// Anywhere in my half: off (the back three rows) unless switched on.
const HALF_KEY = "el-cabeza:set-out-half";
export function loadOwnHalf() {
  try { return window.localStorage.getItem(HALF_KEY) === "1"; } catch (e) { return false; }
}
export function saveOwnHalf(on) {
  try { window.localStorage.setItem(HALF_KEY, on ? "1" : "0"); } catch (e) { /* storage unavailable */ }
}
// Same as last time: the set-out the last game began with (placement.js
// keep()), whichever world it was played in.
const LAST_KEY = "el-cabeza:set-out-last";
export function loadLastSetOut() {
  try { const s = window.localStorage.getItem(LAST_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
export function saveLastSetOut(kept) {
  try { window.localStorage.setItem(LAST_KEY, JSON.stringify(kept)); } catch (e) { /* storage unavailable */ }
}

/* ---- the bench ---------------------------------------------------------- */
// In front of the setting side's edge of the board, past the board's own
// border: how far out, and how deep the camera keeps room for.
export const BENCH_GAP = 0.5;
export const BENCH_ROOM = 2.3;
const BENCH_SPACE = 0.45; // between two pieces on it

/* Where each piece on the bench stands (board-local centre x, z), in a row
   along the setting side's edge, each its own way round (as it'll be set
   out again); a second row further out if one is too long. */
export function benchSpots(bench, side) {
  const sq = SQUARE_SIZE;
  const maxW = SLAB_X;
  const rows = [];
  let row = { items: [], w: 0, d: 0 };
  bench.forEach((p) => {
    const w = p.w * sq, d = p.h * sq;
    if (row.items.length && row.w + BENCH_SPACE + w > maxW) { rows.push(row); row = { items: [], w: 0, d: 0 }; }
    row.w += (row.items.length ? BENCH_SPACE : 0) + w;
    row.d = Math.max(row.d, d);
    row.items.push({ p, w, d });
  });
  if (row.items.length) rows.push(row);
  const out = new Map();
  const sign = side === "dark" ? -1 : 1; // Dark's edge is row 0, at -z
  let reach = SLAB_Z / 2 + BENCH_GAP;
  rows.forEach((r) => {
    let x = -r.w / 2;
    r.items.forEach(({ p, w }) => {
      out.set(p.id, { x: x + w / 2, z: sign * (reach + r.d / 2) });
      x += w + BENCH_SPACE;
    });
    reach += r.d + BENCH_SPACE;
  });
  return out;
}

// The board and the bench together, board-local (x, z) corners, for the
// camera's fit while setting out.
export function setOutCorners(side) {
  const hx = SLAB_X / 2, hz = SLAB_Z / 2;
  const far = side === "dark" ? -(hz + BENCH_GAP + BENCH_ROOM) : hz + BENCH_GAP + BENCH_ROOM;
  return [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz], [-hx, far], [hx, far]];
}

/* ---- picking where a piece goes ----------------------------------------- */
// A board point in squares (row, col, fractional) for a piece's middle:
// the anchor in its rows nearest it, of every one it may be set at.
export function nearestAnchor(so, id, piece, point, list = targets(so, id)) {
  let best = null, bestD = Infinity;
  list.forEach((a) => {
    const d = Math.hypot(a.row + piece.h / 2 - point.row, a.col + piece.w / 2 - point.col);
    if (d < bestD) { bestD = d; best = { ...a, d }; }
  });
  return best;
}
// The anchors where nothing of its side is in the way: the dots.
export function freeAnchors(so, id, piece) {
  const others = so.pieces.filter((q) => q.owner === so.side && q.id !== id);
  return targets(so, id).filter((a) => !others.some((q) => piecesClash({ ...piece, row: a.row, col: a.col }, q)));
}
// Setting `piece` onto `other` (tap one, then another of yours): the
// anchor covering `other` nearest its middle, or null.
export function anchorOnto(so, id, piece, other) {
  const covering = targets(so, id).filter((a) => piecesClash({ ...piece, row: a.row, col: a.col }, other));
  return covering.length ? nearestAnchor(so, id, piece, { row: other.row + other.h / 2, col: other.col + other.w / 2 }, covering) : null;
}

/* ---- the marks on the board --------------------------------------------- */
export const SET_OUT_ACCENT = 0xf2b33d; // the mock-ups' mustard
const MARK_DARK = 0x24170c;
const DANGER = 0xe5392d;

const mat = (color, opacity, top = false) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: !top });
// A flat slab of colour lying on the board (the check alert's way); `top`:
// drawn over the pieces (an edge round one must show past its sides).
function flat(w, d, color, opacity, x, z, y = 0.016, order = 4, top = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat(color, opacity, top));
  m.position.set(x, y, z);
  m.renderOrder = order;
  return m;
}
// A rectangle's edge, solid or dashed, as flat bars (lines have no width).
function rect(group, x0, z0, x1, z1, { color, opacity = 0.95, width = 0.055, dash = 0, gap = 0.16, y = 0.022, order = 5, kind, top = false }) {
  const edge = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-6) return;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const n = dash ? Math.max(1, Math.round(len / (dash + gap))) : 1;
    const step = len / n, piece = dash ? Math.min(dash, step * 0.7) : len + width;
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) * step;
      const bar = flat(Math.abs(ux) > 0.5 ? piece : width, Math.abs(ux) > 0.5 ? width : piece, color, opacity, ax + ux * s, az + uz * s, y, order, top);
      bar.userData = { kind };
      group.add(bar);
    }
  };
  edge(x0, z0, x1, z0); edge(x1, z0, x1, z1); edge(x1, z1, x0, z1); edge(x0, z1, x0, z0);
}
// A word lying on the board, upright to the setting side's player.
function label(text, side, x, z, size = 0.36) {
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  const font = "600 64px 'IBM Plex Mono', ui-monospace, monospace";
  g.font = font;
  const w = Math.ceil(g.measureText(text).width + 40);
  canvas.width = w; canvas.height = 96;
  g.font = font;
  g.textBaseline = "middle";
  g.fillStyle = "#f2b33d";
  g.strokeStyle = "rgba(36, 23, 12, 0.85)";
  g.lineWidth = 10;
  g.lineJoin = "round";
  g.strokeText(text, 20, 50);
  g.fillText(text, 20, 50);
  const tex = new THREE.CanvasTexture(canvas);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * (w / 96), size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = 6;
  const holder = new THREE.Group();
  holder.position.set(x, 0.03, z);
  holder.rotation.y = side === "dark" ? Math.PI : 0;
  holder.add(plane);
  holder.userData = { kind: "set-out-label", text };
  return holder;
}
const footprint = (p) => ({
  x0: p.col * SQUARE_SIZE - OFF_X, z0: p.row * SQUARE_SIZE - OFF_Z,
  x1: (p.col + p.w) * SQUARE_SIZE - OFF_X, z1: (p.row + p.h) * SQUARE_SIZE - OFF_Z,
});

/* The marks for one moment of setting out, into `group` (emptied first by
   the caller). `view`:
     side, half         who's setting out, and their rows
     benchSpots         benchSpots() for the bench as it is
     bench              the pieces on it
     chosen             the piece chosen (on the board or the bench), or null
     dots               where it fits with nothing in the way: anchors
     aim                where a drag (or the keys) would set it: a piece
     danger             pieces to ring in red (a Cabeza that could be crushed
                        on the first move, and what reaches it)
     words              { bench, rows } the labels' words */
export function buildSetOutMarks(group, view) {
  const sq = SQUARE_SIZE;
  const [r0, r1] = zoneRows(view.side, view.half);
  // The rows you may use: a faint wash and a dashed edge.
  {
    const x0 = -OFF_X, x1 = OFF_X, z0 = r0 * sq - OFF_Z, z1 = r1 * sq - OFF_Z;
    const wash = flat(x1 - x0, z1 - z0, SET_OUT_ACCENT, 0.16, (x0 + x1) / 2, (z0 + z1) / 2, 0.014, 3);
    wash.userData = { kind: "set-out-zone" };
    group.add(wash);
    // (A dark line under the bright one: it shows on light squares and dark.)
    rect(group, x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 - 0.05, { color: MARK_DARK, opacity: 0.55, width: 0.12, dash: 0.34, gap: 0.14, y: 0.02, kind: "set-out-zone-edge" });
    rect(group, x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 - 0.05, { color: SET_OUT_ACCENT, width: 0.07, dash: 0.3, gap: 0.18, y: 0.024, order: 6, kind: "set-out-zone-edge" });
    // Its name, at your corner of it.
    const near = view.side === "dark" ? z0 : z1;
    const words = (view.words && view.words.rows) || (view.half ? "Your half" : "Your rows");
    group.add(label(words.toUpperCase(), view.side, view.side === "dark" ? x1 - 1.0 : x0 + 1.0, near + (view.side === "dark" ? 0.32 : -0.32), 0.24));
  }
  // The bench: a dark tray past the board's edge, a dashed rim, its name.
  {
    const hz = SLAB_Z / 2, sign = view.side === "dark" ? -1 : 1;
    const deepest = Math.max(BENCH_ROOM - 0.4, ...[...view.benchSpots.values()].map((s) => Math.abs(s.z) - hz - BENCH_GAP + 0.6));
    const zIn = sign * (hz + BENCH_GAP - 0.2), zOut = sign * (hz + BENCH_GAP + deepest);
    const x0 = -SLAB_X / 2, x1 = SLAB_X / 2;
    const tray = flat(x1 - x0, Math.abs(zOut - zIn), MARK_DARK, 0.4, 0, (zIn + zOut) / 2, -0.004, 2);
    tray.userData = { kind: "set-out-bench" };
    group.add(tray);
    rect(group, x0, Math.min(zIn, zOut), x1, Math.max(zIn, zOut), { color: SET_OUT_ACCENT, dash: 0.3, gap: 0.18, opacity: 0.8, y: 0.004, kind: "set-out-bench-edge" });
    const words = (view.words && view.words.bench) || "Bench";
    if (!view.bench.length) group.add(label(words.toUpperCase(), view.side, 0, (zIn + zOut) / 2, 0.42));
    else group.add(label(words.toUpperCase(), view.side, x1 - 0.95, sign * (hz + BENCH_GAP + 0.05), 0.24));
  }
  // The chosen piece: a solid edge round it, where it stands.
  if (view.chosen) {
    const c = view.chosen;
    const o = 0.07; // just outside it, drawn over its foot
    if (c.where === "board") {
      const f = footprint(c.piece);
      rect(group, f.x0 - o, f.z0 - o, f.x1 + o, f.z1 + o, { color: MARK_DARK, opacity: 0.5, width: 0.13, y: 0.03, order: 8, top: true, kind: "set-out-chosen" });
      rect(group, f.x0 - o, f.z0 - o, f.x1 + o, f.z1 + o, { color: SET_OUT_ACCENT, width: 0.075, y: 0.034, order: 9, top: true, kind: "set-out-chosen" });
    } else if (c.spot) {
      const hw = (c.piece.w * sq) / 2 + o + 0.04, hd = (c.piece.h * sq) / 2 + o + 0.04;
      rect(group, c.spot.x - hw, c.spot.z - hd, c.spot.x + hw, c.spot.z + hd, { color: SET_OUT_ACCENT, width: 0.075, y: 0.01, order: 9, top: true, kind: "set-out-chosen" });
    }
  }
  // Every square it fits with nothing in the way: a dot where its middle
  // would be.
  (view.dots || []).forEach((a) => {
    const p = view.chosen.piece;
    const x = (a.col + p.w / 2) * sq - OFF_X, z = (a.row + p.h / 2) * sq - OFF_Z;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 28), mat(MARK_DARK, 0.6));
    ring.position.set(x, 0.024, z);
    ring.renderOrder = 6;
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.02, 28), mat(SET_OUT_ACCENT, 1));
    dot.position.set(x, 0.03, z);
    dot.renderOrder = 7;
    ring.userData = dot.userData = { kind: "set-out-dot", row: a.row, col: a.col };
    group.add(ring, dot);
  });
  // Where it would land: its squares lit.
  if (view.aim) {
    const f = footprint(view.aim);
    const lit = flat(f.x1 - f.x0 - 0.06, f.z1 - f.z0 - 0.06, SET_OUT_ACCENT, 0.45, (f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2, 0.026, 6);
    lit.userData = { kind: "set-out-aim", row: view.aim.row, col: view.aim.col };
    group.add(lit);
    rect(group, f.x0 - 0.05, f.z0 - 0.05, f.x1 + 0.05, f.z1 + 0.05, { color: SET_OUT_ACCENT, width: 0.07, y: 0.034, order: 9, top: true, kind: "set-out-aim-edge" });
  }
  // A Cabeza that could be crushed on the first move, and what reaches it.
  (view.danger || []).forEach((p) => {
    const f = footprint(p);
    rect(group, f.x0 - 0.06, f.z0 - 0.06, f.x1 + 0.06, f.z1 + 0.06, { color: DANGER, width: 0.085, y: 0.034, order: 9, top: true, kind: "set-out-danger" });
  });
}

/* ---- the banner's words ------------------------------------------------- */
// The piece's name in its world (Dark and Light's own words aside, a piece
// is a piece: the chassis's names).
export const pieceName = (p) => (p && PIECE_META[p.type] ? PIECE_META[p.type].name : "piece");

// Each piece of `next` that stands just as it did in `prev` keeps its old
// object: the board's meshes are rebuilt only for what moved.
const samePlace = (a, b) => a.row === b.row && a.col === b.col && a.w === b.w && a.h === b.h && a.z === b.z
  && (a.vox || "") === (b.vox || "") && a.owner === b.owner && a.type === b.type;
export function keepSame(prev, next) {
  const byId = new Map(prev.map((p) => [p.id, p]));
  return next.map((p) => { const q = byId.get(p.id); return q && samePlace(q, p) ? q : { ...p }; });
}
