/* Every world's device fit: how much drawing a device is given.

   The tier (themes/tienda-quality.js: low, mid or high, picked once from
   what the browser reports) caps the pixel ratio and sizes the key
   light's shadow map, and a governor watches the frame rate: a step
   lower when frames run slow, a step back up, within the cap, when
   there's room. The den and the store had this already (den-fx.js,
   tienda-fx.js, Parrish its own: those keep theirs, theme.ownsPixelRatio)
   and every other world drew at a pixel ratio of 2 with a 4096 shadow
   map on a phone: about 31% more pixels than the den, and some 100 MB of
   graphics memory for the shadow map against 25 MB (user: "go ahead",
   after the efficiency review). Desktops keep what they had. */
import { quality } from "../themes/tienda-quality.js";

export { quality };

/* The governor, as the den's and the store's: frame times over the last
   two seconds or so; a median slower than 42 a second takes the pixel
   ratio down a step (not under the tier's floor), and a 90th percentile
   faster than 56 a second, held for eight seconds since the last rise,
   takes it back up one (not over the tier's cap or the screen's own). */
export function createGovernor(renderer, getSize, q = quality()) {
  let pr = renderer.getPixelRatio();
  const frames = [];
  let lastFrame = 0, lastJudged = 0, lastRaise = 0, settleUntil = 0;
  function setPixelRatio(v) {
    pr = Math.max(q.dprFloor, Math.min(v, q.dprCap, window.devicePixelRatio || 1));
    renderer.setPixelRatio(pr);
    const size = getSize();
    if (size) renderer.setSize(size.w, size.h);
    settleUntil = performance.now() + 1500;
    frames.length = 0;
  }
  function govern(now) {
    const dt = now - lastFrame;
    lastFrame = now;
    if (document.hidden || now < settleUntil || dt <= 0 || dt > 250) return; // tab away, a hitch, or just changed
    frames.push(dt);
    if (frames.length > 120) frames.shift();
    if (now - lastJudged < 2000 || frames.length < 60) return;
    lastJudged = now;
    const sorted = frames.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const slow = sorted[Math.floor(sorted.length * 0.9)];
    if (median > 1000 / 42 && pr > q.dprFloor + 0.01) setPixelRatio(pr - 0.2);
    else if (slow < 1000 / 56 && pr < Math.min(q.dprCap, window.devicePixelRatio || 1) - 0.01 && now - lastRaise > 8000) { lastRaise = now; setPixelRatio(pr + 0.15); }
  }
  return { govern, setPixelRatio };
}
