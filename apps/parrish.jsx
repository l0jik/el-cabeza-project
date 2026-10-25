import React from "react";
import ReactDOM from "react-dom/client";
import { languageReady } from "../chassis/i18n.js";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as parrishTheme from "../themes/parrish.js";
import { realitiesCorner } from "../themes/reality-gate.js";
import { lookName, lookTitle } from "../themes/parrish-looks.js";
import { installParrishClosing } from "../themes/parrish-closing.js";

// After the story: the way into a game here (the gate) and back to the
// other realities (the corner button). themes/reality-gate.js. Each of
// the two palettes is a reality of its own in the switcher (realities.js
// WORLDS: parrish-orinoco, parrish-watermark), "You are here" on the one
// this page shows.
const world = `parrish-${lookName()}`;
// The tab says which (user: "Tá muid beo" / "Go deo na ndeor").
if (typeof document !== "undefined") document.title = `${lookTitle()} \u00b7 El Cabeza`;
const theme = { ...parrishTheme, realityGate: { world }, cornerAction: realitiesCorner(world) };
// Leaving: the closing music first, then the switcher (themes/parrish-closing.js).
installParrishClosing();

applyBootstrapBoardSize();
applyBootstrapLaws();

// (Once the player's language is in: no English first, chassis/i18n.js.)
languageReady().then(() => ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={theme} />
));
