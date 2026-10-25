import React from "react";
import ReactDOM from "react-dom/client";
import { languageReady } from "../chassis/i18n.js";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as noirTheme from "../themes/noir.js";
import { realitiesCorner } from "../themes/reality-gate.js";

// Noir: the game as a night in a film noir city (user: "work on film noir
// now", after the mock-ups), in the theme switcher (user: "Incorporate
// Noir into Theme Switcher now"). The Other realities corner, and the
// gate's look, as Luna's.
const theme = { ...noirTheme, realityGate: { world: "noir" }, cornerAction: realitiesCorner("noir") };

applyBootstrapBoardSize();
applyBootstrapLaws();
// (Once the player's language is in: no English first, chassis/i18n.js.)
languageReady().then(() => ReactDOM.createRoot(document.getElementById("root")).render(<ElCabeza3D theme={theme} />));
