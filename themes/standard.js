/* Standard theme: palette, piece-edge rounding, and board visuals.
   Extracted from el_cabeza_3d.jsx. Everything here is intentionally
   theme-owned rather than shared — Standard and Neon deliberately
   render the board and pieces differently (see themes/neon.js for the
   contrast: bloom textures, additive blending, a dark palette). */

import * as THREE from "three";
import { BOARD_SIZE, SLAB, MARGIN, SQUARE_SIZE, OFF } from "../engine/constants.js";

export const COLORS = {
  /* Lightened from #FDFBF7 — a deliberate, if necessarily small, push:
     the starting value was already close to white, so there's limited
     room to move without losing the warm ivory character entirely.
     This is also the "Light" player's theme color throughout the UI
     (buttons, indicators, the win placard), not just the board surface
     — the two were always the same value and are kept that way here,
     so the board and its own side's UI chrome don't drift apart into
     two different creams. */
  cream: "#FFFEFC",
  creamAlt: "#F2ECDF",
  charcoal: "#242424",
  slate: "#4A5568",
  slateSoft: "rgba(74, 85, 104, 0.22)",
  slateFaint: "rgba(74, 85, 104, 0.12)",
  /* Outer page background — the area outside the app card itself, NOT
     the board. Deliberately a separate name from HEX.wood (the actual
     3D board-edge color, still light): the two happened to be close in
     value before, and giving this its own distinct name here removes
     any risk of future confusion between "the board's own wood tone"
     and "the backdrop behind the whole app," now that they're also
     visually distinct (dark brownish-gray vs. the board's own light
     wood). */
  pageBg: "#4A4038",
  pageBgDeep: "#332B24",
};

export const HEX = {
  /* Kept identical to COLORS.cream, same reasoning as that comment —
     currently unused by any actual Three.js material (the board
     texture is drawn via Canvas 2D with the CSS string COLORS.cream
     directly), but kept in sync regardless so the two never quietly
     diverge if something starts reading this later. */
  cream: 0xfffefc,
  /* Light pieces are deliberately darker than the board cream: at
     0xfdfbf7 they were the same value as the squares beneath them, so
     neither their silhouette nor their shaded faces could register. */
  /* 0xe4dac6 darkened 10% (each channel x0.9). */
  pieceLight: 0xcdc4b2,
  charcoal: 0x242424,
  slate: 0x4a5568,
  wood: 0xddceaf,
};

/* Edge rounding, in board units where one square = 1 inch. 0.125 = a
   1/8" roundover. This is the single number to tune. */
export const EDGE_RADIUS = 0.0625;

export function makeBoardTexture() {
  const RES = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = RES;
  canvas.height = RES;
  const ctx = canvas.getContext("2d");
  const pxPerUnit = RES / SLAB; // pixels per world unit — SLAB is unchanged
  const pad = MARGIN * pxPerUnit; // border thickness in pixels (uses the smaller MARGIN)
  const squarePx = SQUARE_SIZE * pxPerUnit; // each drawn square is now SQUARE_SIZE units wide

  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, RES, RES);

  /* Every square is this same uniform cream — no alternating checker
     fill here anymore. Goal-row tinting still runs per-square below,
     but that's a different thing: a functional marker of the two
     win-condition rows (every square within a goal row gets the same
     tint as its neighbors), not a decorative light/dark pattern. */
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const isGoal = r === 0 || r === BOARD_SIZE - 1;
      if (isGoal) {
        ctx.fillStyle = "rgba(74, 85, 104, 0.055)";
        ctx.fillRect(pad + c * squarePx, pad + r * squarePx, squarePx, squarePx);
      }
    }
  }

  /* Grid lines are drawn as real geometry, not painted here — at
     grazing camera angles a mipmapped hairline disappears. Coordinate
     labels (1-10 / A-J) have been removed from the border entirely. */

  return new THREE.CanvasTexture(canvas);
}

/* Grid as line geometry: resolution-independent, so it stays crisp at
   any zoom and any camera pitch. */
export function makeGrid() {
  const group = new THREE.Group();
  const lines = [];

  /* Every internal line (i = 0..BOARD_SIZE) drawn at one uniform
     opacity — no separate "major" tier for the center-bisecting lines
     (i = 5) or the two edge lines (i = 0, BOARD_SIZE) the way an
     earlier version had. The edges get their own distinct emphasis
     from the charcoal border drawn below regardless, so a second,
     heavier-opacity copy of the grid line sitting exactly underneath
     it was never doing anything visible there anyway — it was only
     ever the center cross that this bucketing was actually making
     look heavier than the rest of the grid. */
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const p = i * SQUARE_SIZE - OFF;
    lines.push(p, 0, -OFF, p, 0, OFF);
    lines.push(-OFF, 0, p, OFF, 0, p);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const gridLines = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: HEX.slate, transparent: true, opacity: 0.3 })
  );
  gridLines.position.y = 0.004;
  group.add(gridLines);

  /* Crisp charcoal border around the playing area. */
  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -OFF, 0, -OFF, OFF, 0, -OFF,
        OFF, 0, -OFF, OFF, 0, OFF,
        OFF, 0, OFF, -OFF, 0, OFF,
        -OFF, 0, OFF, -OFF, 0, -OFF,
      ],
      3
    )
  );
  const border = new THREE.LineSegments(
    borderGeo,
    new THREE.LineBasicMaterial({ color: HEX.charcoal, transparent: true, opacity: 0.8 })
  );
  border.position.y = 0.006;
  group.add(border);

  return group;
}
