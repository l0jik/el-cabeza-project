import React from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as ciudadTheme from "../themes/ciudad.js";
import { realitiesCorner } from "../themes/reality-gate.js";

// Ciudad: the game in the city of the glass towers and cranes (user:
// "implement city as it currently is. Maybe just have a toggle switch to
// switch between the different times of day"). The Other realities
// corner, and the gate's look, as Noir's.
const theme = { ...ciudadTheme, realityGate: { world: "ciudad" }, cornerAction: realitiesCorner("ciudad") };

applyBootstrapBoardSize();
applyBootstrapLaws();
ReactDOM.createRoot(document.getElementById("root")).render(<ElCabeza3D theme={theme} />);
