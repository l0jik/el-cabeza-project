import React from "react";
import ReactDOM from "react-dom/client";
import { languageReady } from "../chassis/i18n.js";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as tiendaTheme from "../themes/tienda.js";
import { realitiesCorner } from "../themes/reality-gate.js";

// After the story: back to the other realities (the corner button;
// themes/reality-gate.js). Nova's own places are the realities' versions.
const theme = { ...tiendaTheme, cornerAction: realitiesCorner("store") };

applyBootstrapBoardSize();
applyBootstrapLaws();

// (Once the player's language is in: no English first, chassis/i18n.js.)
languageReady().then(() => ReactDOM.createRoot(document.getElementById("root")).render(
  // (Up and down tilt the other way here, touch and mouse, user.)
  <ElCabeza3D theme={theme} invertTilt />
));
