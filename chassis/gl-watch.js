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
      if (onStuck) onStuck();
    }, stuckMs);
  };
  const onLose = (e) => {
    // Asking for it back (three.js asks too; this keeps the ask if a
    // renderer ever doesn't).
    e.preventDefault();
    if (lost) return;
    lost = true;
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
