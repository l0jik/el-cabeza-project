import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import ElCabeza3D from "../chassis/ElCabeza3D.jsx";
import * as standardTheme from "../themes/standard.js";
import * as neonTheme from "../themes/neon.js";

const THEMES = {
  standard: { module: standardTheme, label: "Standard", switchLabel: "Connect to Neon" },
  neon: { module: neonTheme, label: "Neon", switchLabel: "Connect to Standard" },
};

function UnifiedApp() {
  const [themeName, setThemeName] = useState("standard");
  const other = themeName === "standard" ? "neon" : "standard";
  const current = THEMES[themeName];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ElCabeza3D key={themeName} theme={current.module} />
      <button
        onClick={() => setThemeName(other)}
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 1000,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.04em",
          borderRadius: 8,
          border: "1px solid rgba(128,128,128,0.4)",
          background: "rgba(20,20,20,0.72)",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {current.switchLabel}
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<UnifiedApp />);
