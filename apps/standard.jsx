import React from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import * as standardTheme from "../themes/standard.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <ElCabeza3D theme={standardTheme} />
);
