import React from "react";
import ReactDOM from "react-dom/client";
import { languageReady } from "../chassis/i18n.js";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as futurisTheme from "../themes/futuris.js";
import { realitiesCorner } from "../themes/reality-gate.js";

// After the story: back to the other realities (the corner button;
// themes/reality-gate.js). Nova's own places are the realities' versions.
const theme = { ...futurisTheme, cornerAction: realitiesCorner("futuris") };

applyBootstrapBoardSize();
applyBootstrapLaws();

// (Once the player's language is in: no English first, chassis/i18n.js.)
languageReady().then(() => ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={theme} />
));
