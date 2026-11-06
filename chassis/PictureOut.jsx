/* What the player reads when the 3D picture is gone (chassis/gl-watch.js:
   the user's Moto G Stylus 5G (2022), "There's something not right here."),
   in the world's own look (its card, ink and title face).

   kind "lost": the board's or the corner piece's picture went out. At once
   the world's own dark covers the browser's white "broken canvas" and its
   sad face, with a line saying the picture's on its way back (`waiting`:
   the browser usually hands it back within a moment, and the cover goes).
   If it doesn't come back, the card: one button that loads the page again
   (the story and the settings are kept, as every load keeps them; a game
   on the board starts over). It goes by itself if the picture comes back
   after all.

   kind "none": the browser won't draw 3D at all (WebGL blocked after a
   crash, or switched off), in place of the empty page there was. */
import React from "react";

const reload = () => {
  try { window.location.reload(); } catch (e) { /* nowhere to go */ }
};

// A colour's brightness, 0 to 1 (#rgb, #rrggbb, rgb()/rgba(); else null).
function brightness(c) {
  const s = String(c || "").trim();
  let r, g, b;
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((x) => x + x).join("") : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (!m) return null;
    [r, g, b] = m[1].split(",").map((x) => parseFloat(x));
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
// Of two inks, the one that stands out more on `ground`.
function inkOn(ground, a, b) {
  const g = brightness(ground), ba = brightness(a), bb = brightness(b);
  if (g == null || ba == null || bb == null) return g != null && g > 0.5 ? "#2A1A10" : "#F3E7CD";
  return Math.abs(ba - g) >= Math.abs(bb - g) ? a : b;
}

export default function PictureOut({ theme, kind = "lost", waiting = false }) {
  const C = (theme && theme.COLORS) || {};
  const ink = C.charcoal || "#2A1A10";
  const paper = (theme && theme.modalSurface) || C.cream || "#F3E7CD";
  const button = C.cream || "#F3E7CD";
  const titleFace = (theme && theme.titleFontFamily) || "'Fraunces', serif";
  const lost = kind === "lost";
  const ground = C.pageBgDeep || C.pageBg || "#1A120B";
  const cover = {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    boxSizing: "border-box",
    // Over the browser's white canvas: the world's own dark, solid, so its
    // sad face doesn't show through.
    background: ground,
    backgroundImage: `radial-gradient(circle at 50% 40%, ${C.pageBg || "#2A1C12"} 0%, ${C.pageBgDeep || "#1A120B"} 75%)`,
    touchAction: "none",
  };
  const css = `@keyframes ecPictureOutIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes ecPictureOutWait{0%,100%{opacity:0.45}50%{opacity:0.9}}@media (prefers-reduced-motion: reduce){[data-testid=picture-out] *{animation:none!important}}[data-testid=picture-out-reload]:focus{outline:none}[data-testid=picture-out-reload]:focus-visible{outline:2px solid ${ink};outline-offset:3px}`;
  if (lost && waiting) {
    return (
      <div data-testid="picture-out" data-kind={kind} data-state="waiting" role="status" aria-live="polite" style={cover}>
        <style>{css}</style>
        <div data-testid="picture-out-wait" style={{ color: inkOn(ground, C.cream || "#F3E7CD", ink), fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, letterSpacing: "0.02em", animation: "ecPictureOutWait 1.6s ease-in-out infinite" }}>
          Bringing the picture back…
        </div>
      </div>
    );
  }
  return (
    <div
      data-testid="picture-out"
      data-kind={kind}
      data-state="card"
      role="alertdialog"
      aria-labelledby="ec-picture-out-title"
      aria-describedby="ec-picture-out-body"
      style={cover}
    >
      <div
        style={{
          width: "min(360px, 100%)",
          boxSizing: "border-box",
          padding: "20px 20px 18px",
          borderRadius: 12,
          background: paper,
          border: `1px solid ${C.slateSoft || "rgba(122, 90, 60, 0.3)"}`,
          boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
          color: ink,
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 14.5,
          lineHeight: 1.5,
          animation: "ecPictureOutIn 220ms ease both",
        }}
      >
        <style>{css}</style>
        <div id="ec-picture-out-title" data-testid="picture-out-title" style={{ fontFamily: titleFace, fontSize: 21, fontWeight: 600, lineHeight: 1.2, marginBottom: 8, textWrap: "balance" }}>
          {lost ? "The picture went out" : "The 3D picture won't start"}
        </div>
        <div id="ec-picture-out-body" data-testid="picture-out-body">
          <p style={{ margin: "0 0 8px" }}>
            {lost
              ? "This device's graphics stopped, and the browser didn't bring them back."
              : "This browser isn't drawing 3D for the game right now. That can happen after a phone's graphics restart."}
          </p>
          <p style={{ margin: 0, opacity: 0.85 }}>
            {lost
              ? "Load the page again to bring the picture back. Your story and settings are kept; a game on the board starts over."
              : "Close the browser completely (on a phone, swipe it away in your recent apps), then open the link again. If it still won't start, turn on hardware acceleration in the browser's settings."}
          </p>
        </div>
        <button
          type="button"
          data-testid="picture-out-reload"
          onClick={reload}
          autoFocus
          style={{
            display: "block",
            width: "100%",
            marginTop: 16,
            padding: "12px 16px",
            border: "none",
            borderRadius: 8,
            background: ink,
            color: button,
            font: "600 15px/1.2 'IBM Plex Sans', sans-serif",
            cursor: "pointer",
            touchAction: "manipulation",
          }}
        >
          {lost ? "Bring the picture back" : "Try again"}
        </button>
      </div>
    </div>
  );
}
