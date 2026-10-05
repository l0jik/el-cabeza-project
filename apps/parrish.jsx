import React from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as parrishTheme from "../themes/parrish.js";
import { realitiesCorner } from "../themes/reality-gate.js";
import { lookName } from "../themes/parrish-looks.js";

// After the story: the way into a game here (the gate) and back to the
// other realities (the corner button). themes/reality-gate.js. Each of
// the two palettes is a reality of its own in the switcher (realities.js
// WORLDS: parrish-orinoco, parrish-watermark), "You are here" on the one
// this page shows.
const world = `parrish-${lookName()}`;
const theme = { ...parrishTheme, realityGate: { world }, cornerAction: realitiesCorner(world) };

applyBootstrapBoardSize();
applyBootstrapLaws();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={theme} />
);
