/* When the picture goes out (user, a photo from a Moto G Stylus 5G (2022):
   a white screen, a small sad face in a box at its top left, the badge and
   the corner piece's glow still up: "I sent the link to a Moto G Stylus 5G
   2022, and it opened it, the link, but this is what came out. There's
   something not right here.").

   That white screen is the browser's own picture. The board and the corner
   piece are each drawn on a canvas with its own WebGL context; when a
   context is lost and the browser won't give it back, Chrome paints that
   canvas white with a sad face in its top left corner (its "broken
   canvas"), and the page's other parts (the badge, the buttons) stay on
   top. A phone loses its contexts when its graphics restart (a driver
   reset, memory running short, the browser sent to the background); the
   browser normally hands them back, and three.js puts back what it had
   drawn (shaders, buffers, textures: everything it had uploaded, measured
   after a loss and a restore in the store: all of it came back). But after
   a graphics crash Chrome can refuse to (it blocks WebGL for a while, or for
   the site), and then nothing comes back until the page is loaded again.
   (Not the phone running short because of the store: measured at the
   Moto's tier, about 42 MB of textures, 122 draw calls and one small shadow
   map; and only two contexts alive at once, well under Android's eight.)

   watchGL(canvas, { onLost, onBack, onStuck }) watches one canvas: onLost
   when its context goes, onBack when the browser gives it back, onStuck
   when it hasn't within STUCK_MS of the page being in view (a page in the
   background isn't counted: a phone often gives the context back as the
   page comes back). From onLost the chassis covers the browser's white
   canvas with the world's dark and "Bringing the picture back…"; from
   onStuck, a card that loads the page again (chassis/PictureOut.jsx).
   STUCK_MS is 4 s: the white is covered meanwhile, and a card that came
   up just as a slow phone gave the picture back would only flash.

   webglWorks() says, once, whether this browser will make a WebGL context
   at all: when it won't (blocked after a crash, switched off), the chassis
   says so instead of leaving an empty page. */

export const STUCK_MS = 4000;

/* Right at Open the box (user, after the fix above: "I should be clear,
   this is what showed up after I clicked open the box"). That tap is the
   one that takes the page full screen (the chassis's first tap; the
   store's lid), and the picture going out as the screen changes size is a
   known trouble on some Android phones. So: when it goes within
   FULLSCREEN_SUSPECT_MS of the switch to full screen and isn't given
   back, this device is remembered (NO_AUTO_FS_KEY, kept apart from the
   game's own keys: ?fresh leaves it, a save doesn't carry it) and the game
   stops switching to full screen by itself here; the full-screen button
   still does. The card says what happened just before (lossInfo), for a
   photo of it. */
export const FULLSCREEN_SUSPECT_MS = 6000;
export const NO_AUTO_FS_KEY = "elcabeza-device:no-auto-fullscreen";
let fullAt = null, tapAt = null, lastLoss = null, glName = "";
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
if (typeof document !== "undefined") {
  const onFull = () => { if (document.fullscreenElement || document.webkitFullscreenElement) fullAt = now(); };
  document.addEventListener("fullscreenchange", onFull, true);
  document.addEventListener("webkitfullscreenchange", onFull, true);
  const onTap = () => { tapAt = now(); };
  document.addEventListener("pointerdown", onTap, { capture: true, passive: true });
  document.addEventListener("touchstart", onTap, { capture: true, passive: true });
}

// May the game switch to full screen by itself on this device?
export function autoFullscreenOk() {
  try { return window.localStorage.getItem(NO_AUTO_FS_KEY) !== "1"; } catch (e) { return true; }
}

// What was going on when the picture last went: { fsAgo, tapAgo } in
// seconds (null: never), whether full screen was blamed, the GPU's name.
export function lossInfo() {
  return lastLoss ? { ...lastLoss, gpu: glName } : null;
}

let works = null;
export function webglWorks() {
  if (works !== null) return works;
  if (typeof document === "undefined") return (works = true);
  // (?nogl: as a browser with WebGL off, to see the message.)
  try { if (/[?&]nogl(&|=|$)/.test(window.location.search)) return (works = false); } catch (e) { /* no address */ }
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
    works = !!gl;
    if (gl) {
      try {
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        glName = String((dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || "");
      } catch (e) { /* unnamed */ }
    }
    // Given back at once: a phone keeps only a few contexts alive.
    const lose = gl && gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
  } catch (e) {
    works = false;
  }
  return works;
}

export function watchGL(canvas, { onLost, onBack, onStuck, stuckMs = STUCK_MS } = {}) {
  if (!canvas || typeof document === "undefined") return () => {};
  let lost = false, stuck = false, timer = null;
  const inView = () => document.visibilityState !== "hidden";
  const arm = () => {
    clearTimeout(timer);
    timer = null;
    if (!lost || stuck || !inView()) return;
    timer = setTimeout(() => {
      timer = null;
      if (!lost || stuck || !inView()) return;
      stuck = true;
      // Gone for good just after the switch to full screen: not by itself
      // again on this device.
      if (lastLoss && lastLoss.fsAgo != null && lastLoss.fsAgo * 1000 <= FULLSCREEN_SUSPECT_MS && !lastLoss.blamedFullscreen) {
        lastLoss.blamedFullscreen = true;
        try { window.localStorage.setItem(NO_AUTO_FS_KEY, "1"); } catch (e) { /* this visit only */ }
      }
      if (onStuck) onStuck();
    }, stuckMs);
  };
  const onLose = (e) => {
    // Asking for it back (three.js asks too; this keeps the ask if a
    // renderer ever doesn't).
    e.preventDefault();
    if (lost) return;
    lost = true;
    // (The first of the canvases to go says when: both go together.)
    const t = now();
    if (!lastLoss || t - lastLoss.t > 3000) {
      const ago = (at) => (at == null ? null : Math.max(0, Math.round((t - at) / 100) / 10));
      lastLoss = { t, fsAgo: ago(fullAt), tapAgo: ago(tapAt), blamedFullscreen: false };
    }
    if (onLost) onLost();
    arm();
  };
  const onRestore = () => {
    if (!lost) return;
    const was = stuck;
    lost = false;
    stuck = false;
    clearTimeout(timer);
    timer = null;
    if (onBack) onBack(was);
  };
  const onView = () => arm();
  canvas.addEventListener("webglcontextlost", onLose);
  canvas.addEventListener("webglcontextrestored", onRestore);
  document.addEventListener("visibilitychange", onView);
  return () => {
    clearTimeout(timer);
    canvas.removeEventListener("webglcontextlost", onLose);
    canvas.removeEventListener("webglcontextrestored", onRestore);
    document.removeEventListener("visibilitychange", onView);
  };
}
