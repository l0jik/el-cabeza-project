import React from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as standardTheme from "../themes/standard.js";
import { realitiesCorner } from "../themes/reality-gate.js";

// After the story: back to the other realities (the corner button;
// themes/reality-gate.js). Nova's own places are the realities' versions.
const theme = { ...standardTheme, cornerAction: realitiesCorner("den") };

applyBootstrapBoardSize();
applyBootstrapLaws();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={theme} />
);
