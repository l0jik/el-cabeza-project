import React from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as lluviaTheme from "../themes/lluvia.js";
import { realitiesCorner } from "../themes/reality-gate.js";

// After the story: the way into a game here (the gate) and back to the
// other realities (the corner button). themes/reality-gate.js.
const theme = { ...lluviaTheme, realityGate: { world: "lluvia", deferred: true }, cornerAction: realitiesCorner("lluvia") };

applyBootstrapBoardSize();
applyBootstrapLaws();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={theme} />
);
