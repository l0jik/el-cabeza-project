import React from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import { applyBootstrapBoardSize } from "./boardBootstrap.js";
import * as standardTheme from "../themes/standard.js";

applyBootstrapBoardSize();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={standardTheme} />
);
