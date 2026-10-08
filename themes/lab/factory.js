/* Theme Lab: a spec (themes/lab/specs.js) in, a chassis theme module out.

   The object returned has exactly the shape of themes/standard.js's
   exports: palette tokens, the board/piece/marker hooks, lights, audio,
   stylesheet, and the two overlay hooks. The chassis can't tell a lab
   theme from any other, which is the point: presentation only.

     Existing game engine (engine/, chassis/)
            ↓
     theme module (this factory's output)  ← presentation adapter
            ↓
     spec (specs.js)                        ← theme configuration
            ↓
     scene.js · ambient.js · hud.js · css.js · audio.js  ← shared primitives
            ↓
     ten visual systems */

import React from "react";
import * as THREE from "three";
import { createScene } from "./scene.js";
import { createAmbient } from "./ambient.js";
import { createLabAudio } from "./audio.js";
import { styleSheetFor } from "./css.js";
import { LabHud } from "./hud.js";
import { sideNamesFor } from "../side-names.js";
import { pointsGlowFor } from "../points-glow.js";

const rgba = (css, a) => {
  const c = new THREE.Color(css);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};
const solid = (css) => (css.startsWith("rgba") ? "#777777" : css);
// Whichever of two colours reads better on a third (WCAG contrast).
const lum = (css) => { const c = new THREE.Color(css); const f = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const bestOn = (bg, p, q) => (contrast(bg, p) >= contrast(bg, q) ? p : q);
// The designs whose two sides are colours, their side buttons inked (below).
const SIDE_INKED = new Set(["bauhaus", "destijl", "neoBrutalist"]);

export function makeLabTheme(spec) {
  const c = spec.colors;
  const scene = createScene(spec);
  // What the HUD sees each render, shared with the ambient layer (which
  // draws selection and hover in the scene).
  const live = { game: null };
  const ink = c.panelInk || c.textPrimary;
  const inkSolid = solid(ink);

  const COLORS = {
    cream: c.surface,
    creamAlt: c.bgSecondary,
    charcoal: inkSolid,
    slate: solid(c.textSecondary),
    slateSoft: rgba(inkSolid, 0.22),
    slateFaint: rgba(inkSolid, 0.1),
    pageBg: c.bgPrimary,
    pageBgDeep: c.bgSecondary,
    bodyDark: c.pieceDark,
    bodyLight: c.pieceLight,
    accentDark: c.pieceDark,
    accentLight: c.pieceLight,
    accentDanger: c.accentPrimary,
    inkOnAccent: inkSolid,
    // Chosen buttons in the design's accent, as anything on is (user).
    selected: solid(c.accentPrimary),
    selectedInk: bestOn(solid(c.accentPrimary), solid(c.surface), inkSolid),
  };
  const HEX = {
    cream: new THREE.Color(c.surface).getHex(),
    charcoal: new THREE.Color(spec.id === "minimalMono" ? "#DDDDDD" : spec.board.sideColor).getHex(),
    slate: new THREE.Color(solid(c.textSecondary)).getHex(),
    pieceLight: new THREE.Color(c.pieceLight).getHex(),
    pieceDark: new THREE.Color(c.pieceDark).getHex(),
    glowCyan: new THREE.Color(c.accentPrimary).getHex(),
    glowAmber: new THREE.Color(c.accentSecondary.startsWith("rgba") ? "#777777" : c.accentSecondary).getHex(),
    structureEdge: new THREE.Color(c.accentPrimary).getHex(),
  };
  const L = spec.lighting;

  return {
    // Identity, for the lab.
    labId: spec.id,
    labSpec: spec,
    realityName: spec.name, // (the info panel's This game tab)
    sideNames: sideNamesFor(spec.id), // what the two sides are called here
    // The buttons and chips that stand for a side (chassis sideFill), in the
    // designs whose sides are colours (red / blue, pink / yellow): each in
    // its side's colour with that side's own ink (what its pieces are
    // lettered in), all at full strength and the pick ringed. As flat fills
    // lettered in the other side's colour and faded when not picked, their
    // words were lost: blue on red, the two AI buttons all but blank (user).
    sideSurface: SIDE_INKED.has(spec.id) ? (side) => (side === "dark" ? { background: c.pieceDark, color: c.inkOnDark } : { background: c.pieceLight, color: c.inkOnLight }) : undefined,
    pointsGlow: pointsGlowFor(spec.id), // the points counter's embers (points-glow.js)

    COLORS, HEX,
    EDGE_RADIUS: scene.EDGE_RADIUS,
    outlineYOffset: scene.outlineYOffset,
    titleFontFamily: spec.typography.display,
    viewPitch: L.pitch,
    rulesColors: { accentDark: c.accentPrimary },
    modalBackdrop: rgba(c.bgSecondary.startsWith("rgba") ? "#000000" : spec.id === "minimalMono" ? "#FFFFFF" : c.textPrimary === "#EAE6DF" || c.textPrimary === "#EEF1F4" || c.textPrimary === "#F2F4F7" ? "#000000" : c.textPrimary, 0.42),
    modalSurface: c.surface,
    canvasGradientStart: c.bgPrimary,
    canvasGradientEnd: c.bgSecondary,
    lights: { ambient: L.ambient, hemi: L.hemi, key: L.key, fill: L.fill, back: L.back },

    hasAudio: true,
    moveCostToggle: true,
    dockWords: spec.words,
    boardTextureFollowsSize: true,
    createAudio: () => createLabAudio(spec.audio),

    makeBoardTexture: scene.makeBoardTexture,
    buildSlabMaterials: scene.buildSlabMaterials,
    makeGrid: scene.makeGrid,
    buildPieceVisual: scene.buildPieceVisual,
    buildMoveIndicator: scene.buildMoveIndicator,
    buildBlackHoleVisual: scene.buildBlackHoleVisual,
    buildMissingSquareVisual: scene.buildMissingSquareVisual,
    mountAmbientEffects: createAmbient(spec, scene, live),

    styleSheet: styleSheetFor(spec),
    renderGlobalDefs: () => null,

    useSetupExtras(x) {
      live.game = x.game;
      return x;
    },
    renderExtraOverlays(x) {
      if (!x) return null;
      return React.createElement(LabHud, { key: `hud-${spec.id}`, spec, x });
    },
  };
}
