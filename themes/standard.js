/* Standard theme: palette, piece-edge rounding, and board visuals.
   Extracted from el_cabeza_3d.jsx. Everything here is intentionally
   theme-owned rather than shared — Standard and Neon deliberately
   render the board and pieces differently (see themes/neon.js for the
   contrast: bloom textures, additive blending, a dark palette). */

import * as THREE from "three";
import { BOARD_SIZE, SLAB, MARGIN, SQUARE_SIZE, OFF, DISC_DIAM, DISC_H, PIECE_SCALE } from "../engine/constants.js";
import { makeRoundedBox } from "../engine/geometry.js";

/* Outline thickness for the silhouette-shell technique below, in world
   units. Standard-only: Neon uses a different outline technique (see
   themes/neon.js's buildPieceVisual) that needs no equivalent
   constant. */
const OUTLINE_T = 0.016;

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

/* Builds a piece's body mesh and its outline shell, given the piece's
   own edge radius (EDGE_RADIUS above) is already baked into `geo`
   wherever the caller built it the same way. Kept as one hook per
   ARCHITECTURE.md: Standard's opaque body + inflated back-face
   silhouette shell is a genuinely different technique from Neon's
   translucent body + traced-edge outline (see themes/neon.js), not
   the same function with different colors. */
export function buildPieceVisual({ piece, isDark, isDisc, geo, center, y }) {
  const mat = new THREE.MeshStandardMaterial({
    color: isDark ? HEX.charcoal : HEX.pieceLight,
    roughness: isDark ? 0.48 : 0.58,
    metalness: 0.04,
    /* No polygonOffset here. Biasing pieces forward was tried and
       reverted: with every mesh pulled -8 and every shell -4, a
       FARTHER piece's mesh could beat a NEARER piece's shell
       wherever their depth difference was smaller than that 4-unit
       gap, so pieces behind punched their outlines through pieces
       in front. Offsets applied per-object break ordering BETWEEN
       those objects; the board is the only surface here that every
       piece must sort against but that never sorts against a
       sibling, which is why the bias belongs there (see the slab's
       top-face material) and not on the pieces. */
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center.x, y, center.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { pieceId: piece.id, kind: "piece" };

  /* Silhouette shell: the same solid grown by OUTLINE_T and drawn
     back-faces-only, so the piece itself covers all of it except a
     thin rim. This is what separates two light pieces sitting side
     by side — a rounded solid has no sharp edge for EdgesGeometry
     to trace, so an outline has to come from the silhouette. */
  const shellGeo = isDisc
    ? new THREE.CylinderGeometry(
        (DISC_DIAM * PIECE_SCALE) / 2 + OUTLINE_T,
        (DISC_DIAM * PIECE_SCALE) / 2 + OUTLINE_T,
        DISC_H * PIECE_SCALE + OUTLINE_T * 2,
        40
      )
    : makeRoundedBox(
        piece.w * PIECE_SCALE + OUTLINE_T * 2,
        piece.z * PIECE_SCALE + OUTLINE_T * 2,
        piece.h * PIECE_SCALE + OUTLINE_T * 2,
        EDGE_RADIUS + OUTLINE_T
      );

  const shell = new THREE.Mesh(
    shellGeo,
    new THREE.MeshBasicMaterial({
      color: isDark ? 0x6f6f6f : HEX.charcoal,
      side: THREE.BackSide,
      /* shadowSide must be set EXPLICITLY here, and must be
         BackSide. This shell casts a shadow (below), and the
         shadow map keeps whichever surface is nearest the light.
         three.js derives shadowSide from `side` when it isn't
         given, and for a BackSide material it picks FrontSide —
         which would record this shell's NEAR surface, sitting
         OUTLINE_T in front of the piece's own lit faces. Every
         piece would then test as being inside its own shadow and
         render fully dark. Recording the FAR surface instead puts
         the occluder behind the piece's lit faces, so the piece
         stays lit while the board beyond it is still shadowed.
         The silhouette is identical either way — front and back
         faces of a closed convex solid share one outline — which
         is exactly the property being exploited. */
      shadowSide: THREE.BackSide,
    })
  );
  /* The shell casts, not just the mesh — see themes/standard.js's
     original comment history for why (matches the shadow's drawn
     silhouette to the outline, not just the mesh's own edge). */
  shell.castShadow = true;
  /* y + OUTLINE_T so the shell's symmetric growth sits entirely above
     the piece, flush with y=0, rather than penetrating the board. */
  shell.position.set(center.x, y + OUTLINE_T, center.z);
  shell.userData = { pieceId: piece.id, kind: "shell" };

  return { mesh, shell };
}
