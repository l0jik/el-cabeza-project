import React from "react";
import ReactDOM from "react-dom/client";
import { languageReady } from "../chassis/i18n.js";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as lunaTheme from "../themes/luna.js";
import { realitiesCorner } from "../themes/reality-gate.js";

// Luna: the game as a moon base (user, after the mock-ups: "deploy this
// now into Theme Switcher"). The Other realities corner, and the gate's
// look when it's picked, as Plano's.
const theme = { ...lunaTheme, realityGate: { world: "luna" }, cornerAction: realitiesCorner("luna") };

applyBootstrapBoardSize();
applyBootstrapLaws();
// (Once the player's language is in: no English first, chassis/i18n.js.)
languageReady().then(() => ReactDOM.createRoot(document.getElementById("root")).render(<ElCabeza3D theme={theme} />));
