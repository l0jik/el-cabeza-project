/* The den's commercial (den-tv.js plays it, den-fx.js calls it up): back
   out of Singularity for the first time in Nova, the set is on and this
   is what's showing. The user's own 1975 spot for El Cabeza (user: three
   AI-made spots of theirs, "Combine them in a creative way"; then "put it
   on the den's TV", in place of the drawn community-access infomercial
   that was here): 30 s, cut by tools/den_spot.py. The den, the set
   pushed into, the store, the hand on a walnut piece; the Singularity
   tears through it and the take changes (the box white, "How you
   whaat?", the flyer garbled for a moment); home again, the family at
   the coffee table; "Your move."; and four frames of a figure before the
   black hole.

   A video beside the page (H.264, or VP9 where there's no H.264; no
   sound: den-ad-audio.js plays that through the set's speaker), muted
   (so it may play without a tap anywhere, phones included), shown on the
   tube as a texture and kept with its sound as it's heard (spotSound,
   below). Until it has
   a picture (still loading, or from disk, where WebGL may not take it)
   the tube shows snow.

   createSingularityFrame (below) is the black hole the set flashes, off,
   while it lures. */

import * as THREE from "three";

export const COMMERCIAL_MS = 30000;

// The spot (build/build.js): H.264 first (Safari wants it), VP9 after.
const SOURCES = [["el-cabeza-den-spot.mp4", "video/mp4"], ["el-cabeza-den-spot.webm", "video/webm"]];
const fromDisk = () => typeof location !== "undefined" && location.protocol === "file:";

/* The one video element, made (and loading) the first time it's asked
   for: in the page (some browsers won't play a muted video that isn't),
   two pixels, nearly transparent, under everything. */
let video = null;
function spotVideo() {
  if (video || typeof document === "undefined" || fromDisk()) return video;
  const v = document.createElement("video");
  v.muted = true; v.defaultMuted = true; v.setAttribute("muted", "");
  v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
  v.preload = "auto"; v.loop = false; v.disablePictureInPicture = true;
  v.setAttribute("aria-hidden", "true"); v.tabIndex = -1;
  v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:0";
  SOURCES.forEach(([src, type]) => { const s = document.createElement("source"); s.src = src; s.type = type; v.appendChild(s); });
  (document.body || document.documentElement).appendChild(v);
  try { v.load(); } catch (e) { /* it'll load on play */ }
  video = v;
  return v;
}
// Well ahead of the commercial (den-ad-audio.js prepareCommercial).
export function prepareCommercialPicture() { spotVideo(); }

const W = 512, H = 384;
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
const MONO = "'Courier Prime', 'Courier New', monospace";
function say(g, str, x, y, { font, color = "#fff", align = "center" }) {
  g.font = font; g.textAlign = align; g.textBaseline = "middle";
  g.fillStyle = color; g.fillText(str, x, y);
}

/* The Singularity, for one frame: a black hole on the starfield, its
   photon ring and the lensed disc in Neon's colours, and the word. */
function blackHole(g, f) {
  g.fillStyle = "#010103"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const b = hash(i * 3.3 + 1);
    g.fillStyle = `rgba(${200 + b * 55},${210 + b * 45},255,${0.25 + b * 0.6})`;
    g.fillRect(hash(i * 7.1) * W, hash(i * 1.9 + 4) * H, b > 0.85 ? 2 : 1, b > 0.85 ? 2 : 1);
  }
  const cx = W / 2 + (hash(f) - 0.5) * 16, cy = H * 0.46, R = 58;
  g.save(); g.translate(cx, cy);
  // The disc, edge-on, brighter on the side coming toward us.
  const disc = g.createLinearGradient(-190, 0, 190, 0);
  disc.addColorStop(0, "rgba(102,217,255,0.95)"); disc.addColorStop(0.5, "rgba(170,110,255,0.75)"); disc.addColorStop(1, "rgba(90,60,200,0.35)");
  g.strokeStyle = disc;
  [[190, 26, 10], [160, 20, 6], [226, 32, 3]].forEach(([rx, ry, lw]) => { g.lineWidth = lw; g.beginPath(); g.ellipse(0, 0, rx, ry, -0.08, 0, Math.PI * 2); g.stroke(); });
  // The far side of the disc, bent up over the top by the hole.
  g.lineWidth = 9; g.strokeStyle = "rgba(150,120,255,0.7)";
  g.beginPath(); g.ellipse(0, -4, R * 1.55, R * 1.3, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  // The photon ring, and the shadow inside it.
  const ring = g.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.35);
  ring.addColorStop(0, "rgba(220,240,255,0)"); ring.addColorStop(0.25, "rgba(220,240,255,0.95)"); ring.addColorStop(0.5, "rgba(102,217,255,0.5)"); ring.addColorStop(1, "rgba(102,217,255,0)");
  g.fillStyle = ring; g.beginPath(); g.arc(0, 0, R * 1.35, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#000"; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  // The near side of the disc, across the front of the shadow.
  g.lineWidth = 7; g.strokeStyle = disc;
  g.beginPath(); g.ellipse(0, 0, 190, 26, -0.08, 0.05, Math.PI - 0.05); g.stroke();
  g.restore();
  say(g, "S I N G U L A R I T Y", W / 2, H * 0.86, { font: `600 22px 'Chakra Petch', ${MONO}`, color: "#66d9ff" });
}

/* The same frame on its own (den-tv.js: flashed on the dead set while it
   lures, before the commercial has ever aired), as the tube's texture. */
export function createSingularityFrame() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const g = c.getContext("2d");
  g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  blackHole(g, 3);
  const texture = new THREE.CanvasTexture(c);
  return { texture, dispose: () => texture.dispose() };
}

/* ------------------------------------------------------ the spot */

/* What the spot's sound is up to, set by den-ad-audio.js while it plays:
   heard() is how far into the spot (s) the sound reaching the ears now is,
   the output's delay allowed for. The picture follows it (user: the voice
   wasn't with the lips; kept to the set's own clock, the picture ran about
   0.1 s ahead of the sound on a computer, and further on a phone, whose
   audio comes out later still). */
export const spotSound = { heard: null };
// (The video started this far ahead of the sound, so its decoder's start
// doesn't leave it behind; and kept within this of it.)
const PREROLL = 0.1, CLOSE = 0.015;

/* The commercial on the tube: its texture, and draw(t) each frame (t in
   seconds from the top, the set's clock, for when there's no sound to
   follow) keeping the video with the sound: held on its first frame
   before it starts, then playing, nudged faster or slower as it drifts,
   put back if it's well off. ready() once it has shown a picture. */
export function createCommercial() {
  const v = spotVideo();
  let texture;
  if (v) {
    texture = new THREE.VideoTexture(v);
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
  } else {
    texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    texture.needsUpdate = true;
  }
  let shown = false, tried = 0, lastDraw = 0, frame = 1 / 60, at = 0;
  const seekTo = (t) => { try { if (!v.seeking) v.currentTime = t; } catch (e) { /* not yet */ } };
  // (playbackRate only set when it changes, so the decoder isn't
  // re-timed every frame.)
  const rateTo = (r) => { if (Math.abs(v.playbackRate - r) > 0.004) v.playbackRate = r; };
  const api = {
    texture,
    ready() {
      if (!shown && v && v.readyState >= 2) shown = true;
      return shown;
    },
    reset() {
      // (A showing's sound is its own: the last one's, played out, is
      // forgotten; this one's, if there's sound, is set just after.)
      spotSound.heard = null; at = 0;
      if (!v) return;
      v.pause(); v.playbackRate = 1;
      if (v.readyState >= 1 && v.currentTime > 0) seekTo(0);
    },
    draw(t) {
      if (!v) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      // (A frame drawn now is on the screen about a frame later: the
      // picture's aimed that far ahead.)
      if (lastDraw && now - lastDraw < 100) frame += ((now - lastDraw) / 1000 - frame) * 0.1;
      lastDraw = now;
      const heard = spotSound.heard ? spotSound.heard() : null;
      at = heard != null ? heard : t;
      if (heard != null) t = heard + Math.min(0.05, Math.max(0.008, frame));
      if (t <= -PREROLL) {
        if (!v.paused) v.pause();
        if (v.readyState >= 1 && v.currentTime > 0.05) seekTo(0);
        return;
      }
      if (v.ended || (v.duration && t >= v.duration)) return;
      if (v.paused) {
        if (t > 0 && v.readyState >= 1 && Math.abs(v.currentTime - t) > 0.12) seekTo(t);
        if (now - tried > 500) { tried = now; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
        return;
      }
      if (t < 0) return; // (rolling from the top, a moment before the sound)
      const drift = v.currentTime - t;
      if (Math.abs(drift) > 0.25) { seekTo(t); rateTo(1); }
      else rateTo(Math.abs(drift) < CLOSE ? 1 : Math.min(1.15, Math.max(0.85, 1 - drift * 2.5)));
    },
    // Over when the sound is (s: the set's clock, in ms; and at most a
    // second after it says so, should the sound have stalled).
    done(s) { return s >= COMMERCIAL_MS + 1000 || (spotSound.heard ? at >= COMMERCIAL_MS / 1000 : s >= COMMERCIAL_MS); },
    pause() { if (v && !v.paused) v.pause(); },
    dispose() { api.pause(); texture.dispose(); },
  };
  return api;
}

// (Test-only: the spot's video, where it is.)
if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
  window.__DEN_SPOT__ = () => (video
    ? { src: video.currentSrc, t: video.currentTime, ready: video.readyState, paused: video.paused, rate: video.playbackRate, duration: video.duration }
    : { src: null, fromDisk: fromDisk() });
}
