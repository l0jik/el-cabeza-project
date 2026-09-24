/* The shape system: pieces that aren't plain boxes (MATTER's Codo and
   Arco — see SINGULARITY_DESIGN.md, "MATTER — new piece types").

   A piece is still described by its bounding box — row/col (top-left
   square), w (columns), h (rows) and z (height, in cubes) — exactly as
   every box piece always has been. An odd-shaped piece ALSO carries
   `vox`: which unit cubes inside that box are actually solid, as a
   canonical string "x,y,l;x,y,l;…" where x is the column offset (0..w-1),
   y the row offset (0..h-1) and l the level above the board (0..z-1).
   A box piece has no `vox` at all and behaves exactly as it always has:
   every cube of its box is solid.

   Occupancy is three-dimensional: two pieces clash only if they share a
   cube. That single rule is what makes an overhang work — a Codo
   balanced on one cube leaves the square beside its foot free at ground
   level, so anything one cube tall can stand there under it; an Arco's
   opening likewise holds whatever fits it. It's also why a Cabeza under
   an overhang is sheltered rather than crushed: the overhang's cube sits
   above the Cabeza, never on it. Box pieces fill every level of their
   footprint from the ground up, so between boxes this reduces exactly to
   the old "footprints overlap" rule.

   Kept free of React/Three.js like the rest of engine/. */

// ---- the canonical cube-list encoding ----

const parseCache = new Map();

/* "x,y,l;…" -> [[x,y,l], …], cached (the same few shapes recur
   endlessly during an AI search). */
export function parseVox(vox) {
  let cubes = parseCache.get(vox);
  if (!cubes) {
    cubes = vox.split(";").map((s) => s.split(",").map(Number));
    parseCache.set(vox, cubes);
  }
  return cubes;
}

/* Canonical form: cubes sorted, so the same pose always yields the same
   string (sameState compares these directly). */
export function voxKey(cubes) {
  return cubes
    .map((c) => c.join(","))
    .sort()
    .join(";");
}

// ---- per-square level masks ----

/* For each square of the piece's footprint, a bitmask of which levels
   hold a cube there (bit 0 = on the board). A box's squares are all
   solid from the ground up — (1 << z) - 1. Cached per shape+box size
   for vox pieces; returned as a flat array indexed [y * w + x]. */
const maskCache = new Map();
function relativeMasks(piece) {
  const key = piece.vox;
  let masks = maskCache.get(key);
  if (!masks) {
    masks = new Array(piece.w * piece.h).fill(0);
    for (const [x, y, l] of parseVox(piece.vox)) masks[y * piece.w + x] |= 1 << l;
    maskCache.set(key, masks);
  }
  return masks;
}

/* The level mask of `piece` at board square (r, c) — 0 if it has no cube
   in that square's column (including squares outside its footprint). */
export function maskAt(piece, r, c) {
  const y = r - piece.row;
  const x = c - piece.col;
  if (y < 0 || x < 0 || y >= piece.h || x >= piece.w) return 0;
  if (!piece.vox) return (1 << piece.z) - 1;
  return relativeMasks(piece)[y * piece.w + x];
}

/* The squares where the piece actually touches the board (a cube at
   level 0). For a box that's its whole footprint; for an overhanging
   pose it's fewer. Missing Squares and Black Holes care about these,
   not about squares a cube merely hangs over. */
export function groundCellsOf(piece) {
  const out = [];
  for (let y = 0; y < piece.h; y++) {
    for (let x = 0; x < piece.w; x++) {
      if (maskAt(piece, piece.row + y, piece.col + x) & 1) out.push([piece.row + y, piece.col + x]);
    }
  }
  return out;
}

/* Do two pieces share any cube? Bounding boxes first (cheap), then the
   per-square level masks over their overlap. */
export function piecesClash(a, b) {
  const r0 = Math.max(a.row, b.row);
  const r1 = Math.min(a.row + a.h, b.row + b.h);
  if (r0 >= r1) return false;
  const c0 = Math.max(a.col, b.col);
  const c1 = Math.min(a.col + a.w, b.col + b.w);
  if (c0 >= c1) return false;
  if (!a.vox && !b.vox) return true; // two boxes: any footprint overlap is a clash
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (maskAt(a, r, c) & maskAt(b, r, c)) return true;
    }
  }
  return false;
}

// ---- rolling ----

/* A roll tips the piece 90° over the bottom edge of its bounding box on
   the side it's rolling toward (the same edge a box has always pivoted
   on — see rollBlock/pivotFor). Each cube is carried rigidly:

     E: x' = l,         l' = w - 1 - x    (col += w)
     W: x' = z - 1 - l, l' = x            (col -= z)
     S: y' = l,         l' = h - 1 - y    (row += h)
     N: y' = z - 1 - l, l' = y            (row -= z)

   and the box's w/h and z swap on that axis, exactly as for a box. A
   bounding box is tight on every side, so the face that comes down
   always has at least one cube on the board: a piece can never end up
   floating. E then W (and S then N) is an exact inverse, which undo
   relies on. */
// rollVox results, cached: an AI search rolls the same few poses the
// same ways thousands of times.
const rollCache = new Map();
export function rollVox(piece, dir) {
  const { w, h, z } = piece;
  const key = `${piece.vox}|${w},${h},${z}|${dir}`;
  const hit = rollCache.get(key);
  if (hit) return hit;
  const out = rollVoxUncached(piece, dir);
  rollCache.set(key, out);
  return out;
}
function rollVoxUncached(piece, dir) {
  const { w, h, z } = piece;
  const cubes = parseVox(piece.vox).map(([x, y, l]) => {
    switch (dir) {
      case "E": return [l, y, w - 1 - x];
      case "W": return [z - 1 - l, y, x];
      case "S": return [x, l, h - 1 - y];
      case "N": return [x, z - 1 - l, y];
      default: return [x, y, l];
    }
  });
  return voxKey(cubes);
}

/* Does rolling `piece` in `dir` sweep any of its cubes through another
   piece's cubes on the way? For two boxes this can never happen without
   the landing itself clashing (a tipping box stays inside the columns of
   its before/after footprints, which boxes fill from the ground up), so
   callers only run this when an odd shape is on the board. With an
   overhang in play it matters: a cube rising or coming down past an
   overhang, or a piece tipping out from under one.

   Each cube turns about the pivot edge in the roll's own vertical
   plane; it's sampled at intermediate angles (the endpoints are the
   start pose and the landing, both checked elsewhere) and tested
   against every cube of every other piece in the same plane with a
   separating-axis test, shrunk by a hair so cubes merely touching edge
   to edge don't count. `ignore` is a piece the landing is allowed to
   hit — the Cabeza being crushed. */
const SWEEP_SAMPLES = 8;
const SWEEP_EPS = 1e-3;
export function rollSweepClashes(pieces, piece, dir, ignore = null) {
  const alongCols = dir === "E" || dir === "W";
  // Pivot position along the roll axis, in square units, and the turn's
  // sign: E/S tip toward increasing col/row (clockwise in the u/v plane
  // below), W/N toward decreasing.
  const pivot = dir === "E" ? piece.col + piece.w : dir === "W" ? piece.col : dir === "S" ? piece.row + piece.h : piece.row;
  const sign = dir === "E" || dir === "S" ? -1 : 1;

  // Moving cubes as (lane, u0, l): lane = the row (E/W) or column (N/S)
  // the cube travels in, u0 = its low edge along the roll axis.
  const moving = [];
  const cubes = piece.vox ? parseVox(piece.vox) : null;
  const pushCube = (x, y, l) => {
    moving.push(alongCols ? [piece.row + y, piece.col + x, l] : [piece.col + x, piece.row + y, l]);
  };
  if (cubes) cubes.forEach(([x, y, l]) => pushCube(x, y, l));
  else for (let y = 0; y < piece.h; y++) for (let x = 0; x < piece.w; x++) for (let l = 0; l < piece.z; l++) pushCube(x, y, l);

  // Obstacle cubes of other pieces, grouped by lane, only in lanes a
  // moving cube uses and within reach of the pivot.
  const lanes = new Set(moving.map((m) => m[0]));
  let reach = 0;
  for (const [, u0, l] of moving) reach = Math.max(reach, Math.hypot(Math.max(Math.abs(u0 - pivot), Math.abs(u0 + 1 - pivot)), l + 1));
  const obstacles = new Map();
  for (const other of pieces) {
    if (other.id === piece.id || other === ignore) continue;
    // Clearance (user rule): a Cabeza is lower than a cube, so every
    // swing passes over it; and a piece sheltered under an overhang or
    // in an opening only gets in the way if it reaches the underside.
    if (other.type === "cabeza" || leavesClearance(piece, other)) continue;
    // Box against box can't clash mid-roll without the landing clashing
    // too (see above), so a box only needs checking against odd shapes.
    if (!piece.vox && !other.vox) continue;
    // Whole-piece reject before looking at cubes: it must share a lane
    // (row for E/W, column for N/S) with the roller and come within reach
    // of the pivot along the roll axis.
    const laneLo = alongCols ? other.row : other.col;
    const laneHi = laneLo + (alongCols ? other.h : other.w) - 1;
    const myLo = alongCols ? piece.row : piece.col;
    const myHi = myLo + (alongCols ? piece.h : piece.w) - 1;
    if (laneHi < myLo || laneLo > myHi) continue;
    const uLo = alongCols ? other.col : other.row;
    const uHi = uLo + (alongCols ? other.w : other.h);
    if (uHi < pivot - reach - 1 || uLo > pivot + reach + 1) continue;
    for (let y = 0; y < other.h; y++) {
      for (let x = 0; x < other.w; x++) {
        const lane = alongCols ? other.row + y : other.col + x;
        if (!lanes.has(lane)) continue;
        const u = alongCols ? other.col + x : other.row + y;
        if (Math.abs(u + 0.5 - pivot) > reach + 1) continue;
        const mask = maskAt(other, other.row + y, other.col + x);
        for (let l = 0; mask >> l; l++) {
          if (!((mask >> l) & 1)) continue;
          if (!obstacles.has(lane)) obstacles.set(lane, []);
          obstacles.get(lane).push([u, l]);
        }
      }
    }
  }
  if (!obstacles.size) return false;

  for (let k = 1; k < SWEEP_SAMPLES; k++) {
    const phi = (sign * (Math.PI / 2) * k) / SWEEP_SAMPLES;
    const cs = Math.cos(phi);
    const sn = Math.sin(phi);
    for (const [lane, u0, l] of moving) {
      const obs = obstacles.get(lane);
      if (!obs) continue;
      // The cube's four corners, turned about (pivot, 0).
      const corners = [
        [u0, l], [u0 + 1, l], [u0 + 1, l + 1], [u0, l + 1],
      ].map(([u, v]) => {
        const du = u - pivot;
        return [pivot + du * cs - v * sn, du * sn + v * cs];
      });
      // The turned square's bounding box: most obstacles are nowhere
      // near it, and the full separating-axis test is only needed for
      // the ones this can't rule out.
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      for (const [cu, cv] of corners) {
        if (cu < minU) minU = cu;
        if (cu > maxU) maxU = cu;
        if (cv < minV) minV = cv;
        if (cv > maxV) maxV = cv;
      }
      for (const [ou, ol] of obs) {
        if (maxU - SWEEP_EPS <= ou + SWEEP_EPS || ou + 1 - SWEEP_EPS <= minU + SWEEP_EPS) continue;
        if (maxV - SWEEP_EPS <= ol + SWEEP_EPS || ol + 1 - SWEEP_EPS <= minV + SWEEP_EPS) continue;
        if (squaresOverlap(corners, ou, ol)) return true;
      }
    }
  }
  return false;
}

// ---- pivoting (Cantilever Pivot LAW) ----

/* The one square a piece stands on, if it stands on exactly one — the
   cube it can pivot about. null for a piece with more ground contact
   (every box, and most poses of an odd shape). */
export function pivotCellOf(piece) {
  if (!piece.vox) return null;
  const cells = groundCellsOf(piece);
  return cells.length === 1 ? { row: cells[0][0], col: cells[0][1] } : null;
}

/* The piece after a quarter turn about the vertical axis through its
   planted cube: "cw" or "ccw" as seen from above, looking down on the
   board with rows running down the screen (so cw takes an arm pointing
   east round to the south). Every cube keeps its level; the planted
   column turns in place. Returns the new bounding box and cubes. */
export function pivotPiece(piece, turn) {
  const pc = pivotCellOf(piece);
  const cubes = parseVox(piece.vox).map(([x, y, l]) => {
    const dx = piece.col + x - pc.col;
    const dy = piece.row + y - pc.row;
    const [nx, ny] = turn === "cw" ? [-dy, dx] : [dy, -dx];
    return [pc.col + nx, pc.row + ny, l];
  });
  const col = Math.min(...cubes.map((c) => c[0]));
  const row = Math.min(...cubes.map((c) => c[1]));
  const w = Math.max(...cubes.map((c) => c[0])) - col + 1;
  const h = Math.max(...cubes.map((c) => c[1])) - row + 1;
  return {
    ...piece,
    row,
    col,
    w,
    h,
    vox: voxKey(cubes.map(([c, r, l]) => [c - col, r - row, l])),
  };
}

/* Where a pivot's arm ends up: the bounding box of every square the
   piece covers other than its planted one. The move indicator for a
   pivot sits there — the square the player taps to swing the arm onto. */
export function pivotArmFootprint(piece) {
  const pc = pivotCellOf(piece);
  let r0 = Infinity, c0 = Infinity, r1 = -Infinity, c1 = -Infinity;
  for (let r = piece.row; r < piece.row + piece.h; r++) {
    for (let c = piece.col; c < piece.col + piece.w; c++) {
      if ((r === pc.row && c === pc.col) || !maskAt(piece, r, c)) continue;
      r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r); c1 = Math.max(c1, c);
    }
  }
  return { row: r0, col: c0, w: c1 - c0 + 1, h: r1 - r0 + 1 };
}

/* Does the pivot's swinging arm pass through another piece's cube on
   its way round? Each cube off the pivot column sweeps a quarter circle
   at its own level; it's sampled at intermediate angles (the start and
   end poses are checked elsewhere) against every other piece's cube at
   that same level, with the same separating-axis test the roll sweep
   uses — here in the board's plane (u = column, v = row). A one-square
   arm sweeps its destination square and the diagonal square between
   the two headings. Swinging over the board's edge is fine: it's air. */
export function pivotSweepClashes(pieces, piece, turn) {
  const pc = pivotCellOf(piece);
  const cu = pc.col + 0.5;
  const cv = pc.row + 0.5;
  const arm = parseVox(piece.vox)
    .map(([x, y, l]) => [piece.col + x, piece.row + y, l])
    .filter(([c, r]) => c !== pc.col || r !== pc.row);
  if (!arm.length) return false;
  const reach = Math.max(...arm.map(([c, r]) => Math.hypot(c + 0.5 - cu, r + 0.5 - cv))) + 1;
  const sign = turn === "cw" ? 1 : -1;
  for (const other of pieces) {
    if (other.id === piece.id || other.type === "cabeza") continue; // lower than a cube: swung over
    if (other.row > cv + reach || other.row + other.h < cv - reach) continue;
    if (other.col > cu + reach || other.col + other.w < cu - reach) continue;
    for (let r = other.row; r < other.row + other.h; r++) {
      for (let c = other.col; c < other.col + other.w; c++) {
        const mask = maskAt(other, r, c);
        if (!mask) continue;
        for (const [ac, ar, l] of arm) {
          if (!((mask >> l) & 1)) continue;
          for (let k = 1; k < SWEEP_SAMPLES; k++) {
            const phi = (sign * (Math.PI / 2) * k) / SWEEP_SAMPLES;
            const cs = Math.cos(phi);
            const sn = Math.sin(phi);
            // Rows run down the screen, so this turns (u, v) clockwise
            // as seen from above for a positive angle.
            const corners = [[ac, ar], [ac + 1, ar], [ac + 1, ar + 1], [ac, ar + 1]].map(([u, v]) => {
              const du = u - cu;
              const dv = v - cv;
              return [cu + du * cs - dv * sn, cv + du * sn + dv * cs];
            });
            if (squaresOverlap(corners, c, r)) return true;
          }
        }
      }
    }
  }
  return false;
}

/* Whether `other` sits wholly beneath `piece` without reaching its
   underside anywhere: every square `other` stands on is roofed by one of
   `piece`'s cubes, and `other`'s top stops below that roof. Such a piece
   never blocks `piece`'s roll, however the swing would geometrically
   pass (a Turrito in an Arco Alto's two-tall opening). One that fills
   the gap up to the underside (a Turrito under a Codo's arm, a standing
   1x2 in the Alto) does, on the moves that swing into it. */
function leavesClearance(piece, other) {
  for (let r = other.row; r < other.row + other.h; r++) {
    for (let c = other.col; c < other.col + other.w; c++) {
      const own = maskAt(other, r, c);
      if (!own) continue;
      const roof = maskAt(piece, r, c);
      if (!roof) return false; // not under the piece here
      const top = 32 - Math.clz32(own); // levels other fills: 0 .. top-1
      const underside = 31 - Math.clz32(roof & -roof); // lowest level of the roof
      if (top >= underside) return false; // reaches the underside (or worse)
    }
  }
  return true;
}

/* Separating-axis test between a turned unit square (its 4 corners) and
   the axis-aligned unit square [ou, ou+1] x [ol, ol+1], both shrunk by
   SWEEP_EPS so shared edges don't count as overlap. */
function squaresOverlap(corners, ou, ol) {
  const axes = [
    [1, 0],
    [0, 1],
    [corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]],
    [corners[3][0] - corners[0][0], corners[3][1] - corners[0][1]],
  ];
  const box = [[ou, ol], [ou + 1, ol], [ou + 1, ol + 1], [ou, ol + 1]];
  for (const [ax, ay] of axes) {
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const [px, py] of corners) { const d = px * ax + py * ay; if (d < aMin) aMin = d; if (d > aMax) aMax = d; }
    for (const [px, py] of box) { const d = px * ax + py * ay; if (d < bMin) bMin = d; if (d > bMax) bMax = d; }
    const len = Math.hypot(ax, ay);
    if (aMax - SWEEP_EPS * len <= bMin + SWEEP_EPS * len || bMax - SWEEP_EPS * len <= aMin + SWEEP_EPS * len) return false;
  }
  return true;
}

/* Whether any piece in play has an odd shape — the switch for the extra
   (costlier) roll-sweep check above. A game of box pieces never pays
   for it. */
export function anyOddShape(pieces) {
  for (const p of pieces) if (p.vox) return true;
  return false;
}

/* How many cubes a piece is made of — "bigger" for the Shoving law. A
   Cabeza counts as one. */
export function cubeCount(piece) {
  return piece.vox ? parseVox(piece.vox).length : piece.w * piece.h * piece.z;
}

/* The same shape turned 180° about the vertical axis (x -> w-1-x,
   y -> h-1-y, levels unchanged) — how Light's copy of a piece mirrors
   Dark's in a rotationally symmetric opening (see generateAnomalySetup
   in themes/neon.js, which mirrors positions the same way). */
export function mirrorVox(piece) {
  return voxKey(parseVox(piece.vox).map(([x, y, l]) => [piece.w - 1 - x, piece.h - 1 - y, l]));
}
