import React from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as tiendaTheme from "../themes/tienda.js";
import { realitiesCorner } from "../themes/reality-gate.js";

// After the story: back to the other realities (the corner button;
// themes/reality-gate.js). Nova's own places are the realities' versions.
const theme = { ...tiendaTheme, cornerAction: realitiesCorner("store") };

applyBootstrapBoardSize();
applyBootstrapLaws();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={theme} />
);
