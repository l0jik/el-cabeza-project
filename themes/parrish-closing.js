/* Leaving Orinoco or Watermark (user: "the closing music needs to complete
   before it goes back to the menu switcher"): a tap on Other realities
   starts the close (the end of "Orinoco Flow", parrish-audio.js), the
   painting fades slowly towards the dark, and the switcher opens as the
   music ends, about 10.5 s on; its hall rings on under the switcher. A tap
   or a key meanwhile opens it at once (the music plays on). With the sound
   off, a short fade only. If the player stays after all ("You are here",
   Escape), the painting comes back. Installed by apps/parrish.jsx through
   reality-gate.js setRealitiesPrelude. */

import { setRealitiesPrelude } from "./reality-gate.js";
import { REALITIES_STAY_EVENT } from "./realities.js";
import { PARRISH_CLOSING_EVENT } from "./parrish-audio.js";
import { lookName } from "./parrish-looks.js";

const QUIET_MS = 1200; // the sound off: a short fade only

export function installParrishClosing() {
  if (typeof document === "undefined") return;
  const dark = lookName() === "watermark" ? "10, 2, 3" : "8, 17, 40";
  let veil = null, closing = false;

  function lift() {
    if (!veil) return;
    const v = veil; veil = null;
    v.style.transition = "opacity 0.8s ease"; v.style.opacity = "0";
    setTimeout(() => v.remove(), 900);
  }
  window.addEventListener(REALITIES_STAY_EVENT, lift);

  setRealitiesPrelude((open) => {
    if (closing) return;
    closing = true;
    // How long the music runs (parrish-audio.js fills it in when it can be
    // heard); the close starts now.
    const detail = { ms: QUIET_MS };
    try { window.dispatchEvent(new CustomEvent(PARRISH_CLOSING_EVENT, { detail })); } catch (e) { /* no events */ }
    const ms = detail.ms;
    if (veil) veil.remove();
    veil = document.createElement("div");
    veil.setAttribute("data-testid", "parrish-closing");
    veil.setAttribute("aria-hidden", "true");
    Object.assign(veil.style, {
      position: "fixed", inset: "0", zIndex: "1590", background: `rgb(${dark})`, opacity: "0",
      transition: `opacity ${ms}ms cubic-bezier(0.3, 0.15, 0.5, 1)`, cursor: "pointer",
    });
    document.body.appendChild(veil);
    void veil.offsetWidth; // (its start, laid down, so the fade runs from it)
    veil.style.opacity = "0.85";
    let timer = 0;
    const done = () => {
      if (!closing) return;
      closing = false;
      clearTimeout(timer);
      window.removeEventListener("keydown", skip, true);
      if (veil) veil.removeEventListener("pointerdown", skip);
      open();
    };
    const skip = (e) => { if (e && e.type === "keydown" && e.key === "Tab") return; done(); };
    timer = setTimeout(done, ms);
    veil.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip, true);
  });
}
