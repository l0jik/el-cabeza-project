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
   after the efficiency review). Desktops keep what they had.

   Smoother on a weak machine (user: "We need to see how we can make the
   animations run more smoothly for low capability machines"): one
   governor for every world now (the den's, the store's and Parrish's
   make their own with their own limits and hand it to the chassis,
   three.current.governor), quicker to act, and with more to give than
   the pixel ratio:
     - it judges after a second of frames, not two, and a frame rate far
       under (below 24 a second) takes a bigger step;
     - frames that drew the shadows again (something moving: a roll, the
       board turning) are watched on their own: when those run slow and
       the rest don't, the shadow map is what's halved (it is drawn again
       on every such frame, and at 4096 that's four times the pixels of
       the screen), down to 512;
     - at the pixel ratio's floor and still slow, the shadow map halves,
       and then the frames are held to a steady 30 a second (a frame
       every other refresh): a frame rate that can't hold 60 lands
       sometimes on one refresh and sometimes on two, and that unevenness
       is the stutter; 30 evenly reads smoother. Held there, every
       refresh is still watched, and when they all come on time the cap
       comes off;
     - what it settles on is remembered for the device (localStorage
       el-cabeza:fit, by tier and world), so the next visit starts there
       and its opening moves are smooth from the first;
     - back up the same way, slowly: the cap off first, then the shadow
       map, then the pixel ratio, each after 8 s of room.
   Under the browser tests (__EC_TEST_HOOKS__) only the pixel ratio moves,
   as before, and nothing is remembered: their software renderer is slow
   on every frame. A test that wants the rest sets __EC_TEST_FIT__. */
import { quality } from "../themes/tienda-quality.js";

export { quality };

const STORE = "el-cabeza:fit";
const SLOW = 1000 / 42, FAST = 1000 / 56, CRAWL = 1000 / 24;
const readAll = () => { try { return JSON.parse(window.localStorage.getItem(STORE) || "{}") || {}; } catch (e) { return {}; } };

/* renderer, getSize() -> { w, h }; q: the tier's settings; opts:
     floor, cap   the pixel ratio's range (the tier's by default)
     stepDown, stepUp   its steps (0.2 down, 0.15 up)
     key          the world, for what's remembered
     light()      the light whose shadow map may be made smaller
     onChange({ pixelRatio, shadowMap, paced })   after any change */
export function createGovernor(renderer, getSize, q = quality(), opts = {}) {
  const floor = opts.floor ?? q.dprFloor, cap = opts.cap ?? q.dprCap;
  const stepDown = opts.stepDown ?? 0.2, stepUp = opts.stepUp ?? 0.15;
  const testing = typeof window !== "undefined" && !!window.__EC_TEST_HOOKS__;
  const full = !testing || !!window.__EC_TEST_FIT__;
  const name = `${q.tier}|${opts.key || "world"}`;
  const topRatio = () => Math.min(cap, window.devicePixelRatio || 1);
  const fullShadow = q.shadowMap, minShadow = Math.min(fullShadow, 512);
  let pr = renderer.getPixelRatio(), shadow = fullShadow, paced = false;
  const frames = [], busy = [], raw = [];
  let lastFrame = 0, lastRaw = 0, lastDrawn = 0, lastJudged = 0, lastEase = 0, lastRelief = -Infinity, settleUntil = 0, saveTimer = null, wasBusy = false, firstAt = 0, crawling = 0;

  function changed() {
    if (opts.onChange) opts.onChange({ pixelRatio: pr, shadowMap: shadow, paced });
    if (!full || typeof window === "undefined") return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const all = readAll();
      all[name] = { pr: +pr.toFixed(3), shadow, paced };
      try { window.localStorage.setItem(STORE, JSON.stringify(all)); } catch (e) { /* private mode */ }
    }, 3000);
  }
  function settle(ms = 1000) {
    settleUntil = performance.now() + ms;
    frames.length = 0; busy.length = 0; raw.length = 0; wasBusy = false;
  }
  function setPixelRatio(v) {
    pr = Math.max(floor, Math.min(v, topRatio()));
    renderer.setPixelRatio(pr);
    const size = getSize();
    if (size) renderer.setSize(size.w, size.h);
    settle();
    changed();
  }
  function setShadow(s) {
    const light = opts.light && opts.light();
    if (!light || !light.shadow) return false;
    shadow = s;
    light.shadow.mapSize.set(s, s);
    if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
    settle();
    changed();
    return true;
  }
  function setPaced(v) {
    paced = v;
    lastDrawn = 0;
    settle();
    changed();
  }

  // Where it left off last time on this device.
  if (full) {
    const was = readAll()[name];
    if (was) {
      if (was.pr > 0) setPixelRatio(was.pr);
      if (was.shadow && was.shadow < fullShadow && was.shadow >= minShadow) shadow = was.shadow; // (put on the light at the first frame)
      paced = !!was.paced;
    }
  }
  let shadowPlaced = shadow === fullShadow;

  const sorted = (a) => a.slice().sort((x, y) => x - y);
  const at = (s, k) => s[Math.min(s.length - 1, Math.floor(s.length * k))];

  // One step less to draw: the pixel ratio, then the shadow map, then 30 a second.
  function relieve(median, motionOnly) {
    lastRelief = performance.now();
    if (!motionOnly && pr > floor + 0.01) { setPixelRatio(pr - (median > CRAWL ? stepDown * 1.5 : stepDown)); return; }
    if (full && shadow > minShadow && setShadow(shadow / 2)) return;
    if (motionOnly && pr > floor + 0.01) { setPixelRatio(pr - stepDown); return; }
    if (full && !paced) setPaced(true);
  }
  // One step back up, the other way round.
  function ease(now) {
    if (now - lastEase < 8000 || now - lastRelief < 15000) return;
    lastEase = now;
    if (paced) { setPaced(false); return; }
    if (shadow < fullShadow && setShadow(shadow * 2)) return;
    if (pr < topRatio() - 0.01) setPixelRatio(pr + stepUp);
  }

  return {
    /* Whether to skip this refresh (held to 30 a second). Called at the
       top of every frame; a skipped one draws nothing. */
    skip(now) {
      if (!paced) return false;
      const d = now - lastRaw;
      lastRaw = now;
      if (d > 0 && d < 250 && now >= settleUntil) { raw.push(d); if (raw.length > 180) raw.shift(); }
      if (lastDrawn && now - lastDrawn < 1000 / 30 - 5) return true;
      lastDrawn = now;
      return false;
    },
    // A frame drawn; busy: it drew the shadows again (something moved).
    govern(now, isBusy = false) {
      if (!shadowPlaced) { shadowPlaced = true; if (!setShadow(shadow)) shadow = fullShadow; }
      const dt = now - lastFrame;
      lastFrame = now;
      // (A frame's own cost shows in the time to the next one.)
      const after = wasBusy;
      wasBusy = isBusy;
      if (document.hidden || now < settleUntil || dt <= 0) return; // tab away, or just changed
      // A frame over a quarter of a second is a hitch, not counted; five
      // in a row is a device that slow (under 4 a second): a step down.
      if (dt > 250) { if (full && ++crawling >= 5) { crawling = 0; relieve(dt, false); } return; }
      crawling = 0;
      if (!frames.length) firstAt = now;
      frames.push(dt);
      if (frames.length > 120) frames.shift();
      if (after) { busy.push([now, dt]); if (busy.length > 90) busy.shift(); }
      // (Thirty frames, or ten over two seconds when they're that slow.)
      if (now - lastJudged < 1000 || (frames.length < 30 && !(frames.length >= 10 && now - firstAt >= 2000))) return;
      lastJudged = now;
      const all = sorted(frames), median = at(all, 0.5), p90 = at(all, 0.9);
      // (The moving frames of the last 10 s.)
      while (busy.length && now - busy[0][0] > 10000) busy.shift();
      const moving = busy.length >= 12 ? sorted(busy.map((b) => b[1])) : null;
      if (paced) {
        // Held to 30: every refresh (drawn or skipped) on time means there's room for 60.
        if (raw.length >= 90) { const r = sorted(raw); if (at(r, 0.9) < 1000 / 55) ease(now); }
        return;
      }
      if (median > SLOW) relieve(median, false);
      else if (moving && at(moving, 0.5) > SLOW) relieve(at(moving, 0.5), true);
      else if (p90 < FAST && (!moving || at(moving, 0.9) < FAST)) ease(now);
    },
    setPixelRatio,
    state: () => ({ pixelRatio: pr, shadowMap: shadow, paced }),
  };
}
