import React from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize, applyBootstrapLaws } from "./boardBootstrap.js";
import * as neonTheme from "../themes/neon.js";

applyBootstrapBoardSize();
applyBootstrapLaws();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={neonTheme} />
);
