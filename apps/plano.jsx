import React from "react";
import ReactDOM from "react-dom/client";
import { languageReady } from "../chassis/i18n.js";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as planoTheme from "../themes/plano.js";
import { realitiesCorner } from "../themes/reality-gate.js";

// After the story: the way into a game here (the gate) and back to the
// other realities (the corner button). themes/reality-gate.js.
const theme = { ...planoTheme, realityGate: { world: "plano" }, cornerAction: realitiesCorner("plano") };

applyBootstrapBoardSize();
applyBootstrapLaws();

// (Once the player's language is in: no English first, chassis/i18n.js.)
languageReady().then(() => ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={theme} />
));
