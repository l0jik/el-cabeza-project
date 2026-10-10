/* ?fps: a small readout for seeing how a world runs on a device (user:
   "add the fps readout", to compare before and after on their own
   phone). ?fps turns it on for the tab (it stays on from page to page
   there), ?fps=0 turns it off. It never takes a tap.

   Once a second: frames a second and the average frame; the slowest
   frame; the main loop's own time a frame (its script and the drawing it
   hands the graphics chip; the chip's own time a page can't see); the
   pixel ratio and the device's tier; the shadow map's size and how many
   times a second it was drawn; and what the last frame drew. */
const KEY = "el-cabeza:fps";

export function fpsWanted() {
  try {
    const v = new URLSearchParams(window.location.search).get("fps");
    if (v !== null) {
      if (v === "0" || v === "off") window.sessionStorage.removeItem(KEY);
      else window.sessionStorage.setItem(KEY, "1");
    }
    return window.sessionStorage.getItem(KEY) === "1";
  } catch (e) {
    return false;
  }
}

export function createFpsReadout() {
  const el = document.createElement("div");
  el.dataset.testid = "fps-readout";
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed", left: "6px", top: "50%", transform: "translateY(-50%)", zIndex: "2147483000",
    pointerEvents: "none", userSelect: "none", whiteSpace: "pre",
    font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontVariantNumeric: "tabular-nums",
    color: "#fff", background: "rgba(0, 0, 0, 0.62)", padding: "5px 7px", borderRadius: "5px",
  });
  el.textContent = "fps …";
  document.body.appendChild(el);

  let frames = 0, sum = 0, worst = 0, work = 0, shadows = 0, since = performance.now(), last = 0;
  return {
    /* One frame: its time stamp, the main loop's own milliseconds, and
       whether the shadows were drawn. `about()` is only asked once a
       second, for the rest of the line. */
    frame(now, ms, shadowDrawn, about) {
      const dt = last ? now - last : 0;
      last = now;
      // (Not the gap while the tab was away.)
      if (dt > 0 && dt < 5000) { frames++; sum += dt; if (dt > worst) worst = dt; }
      work += ms;
      if (shadowDrawn) shadows++;
      const span = now - since;
      if (span < 1000) return;
      const a = about();
      const fps = sum > 0 ? (frames * 1000) / sum : 0;
      const k = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);
      el.textContent = [
        `${fps.toFixed(0)} fps  ${frames ? (sum / frames).toFixed(1) : "–"} ms`,
        `slowest ${worst.toFixed(0)} ms`,
        `main loop ${frames ? (work / Math.max(1, frames)).toFixed(1) : "–"} ms`,
        `×${a.pixelRatio.toFixed(2)}  ${a.tier}`,
        `shadows ${a.shadowMap || "off"}  ${a.shadowsAlways ? "every frame" : `${Math.round((shadows * 1000) / span)}/s`}`,
        `${k(a.calls)} draws  ${k(a.triangles)} tris`,
      ].join("\n");
      frames = 0; sum = 0; worst = 0; work = 0; shadows = 0; since = now;
    },
    dispose() {
      el.remove();
    },
  };
}
