/* The den's commercial's sound (den-commercial.js has its picture,
   den-audio.js's tvCommercial plays this): the user's spot's own sound
   (tools/den_spot.py), a recording beside the page. It's fetched and
   decoded well before it's needed (prepareCommercial, which starts the
   picture loading too, unless told not yet: { picture: false }), and
   played as one buffer on the audio clock, so
   it starts with the picture; if it isn't ready in time, it picks up from
   where it should be once it is. Through the set's speaker, gently (a
   little low end off, a touch more presence, the top a little soft), at
   about the level the drawn commercial's soundtrack had. From disk (no
   fetch there), an <audio> element instead, straight out. stop() fades it
   at once. */

import { COMMERCIAL_MS, prepareCommercialPicture } from "./den-commercial.js";

const TRACK_URL = "el-cabeza-den-spot.mp3";
// (The recording is mastered to -16 LUFS; the drawn one's ran at -20.)
const LEVEL = 0.6;
const rendered = { buffer: null, promise: null };
const fromDisk = () => typeof location !== "undefined" && location.protocol === "file:";
const decode = (c, ab) => new Promise((res, rej) => { const p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
export function prepareCommercial({ picture = true } = {}) {
  if (picture) prepareCommercialPicture();
  if (rendered.buffer || rendered.promise) return rendered.promise;
  if (typeof OfflineAudioContext === "undefined" || typeof fetch === "undefined" || fromDisk()) return null;
  rendered.promise = (async () => {
    const r = await fetch(TRACK_URL);
    if (!r.ok) throw new Error(String(r.status));
    // (Decoded on a context of its own: a buffer plays on any.)
    rendered.buffer = await decode(new OfflineAudioContext(2, 1, 44100), await r.arrayBuffer());
    return rendered.buffer;
  })().catch(() => { rendered.promise = null; return null; });
  return rendered.promise;
}
// (Test-only: is the recording here, or on its way?)
if (typeof window !== "undefined") {
  window.__EC_AD__ = () => ({ rendered: !!rendered.buffer, pending: !!rendered.promise && !rendered.buffer, seconds: rendered.buffer ? rendered.buffer.duration : 0 });
}

export function playCommercial(ctx, dest, { delay = 0 } = {}) {
  const T = ctx.currentTime + delay;
  const END = T + COMMERCIAL_MS / 1000;
  // The set's speaker.
  const g = ctx.createGain(); g.gain.value = LEVEL;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120; hp.Q.value = 0.6;
  const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 1700; pk.Q.value = 0.8; pk.gain.value = 1.5;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7500; lp.Q.value = 0.5;
  g.connect(hp).connect(pk).connect(lp).connect(dest);
  let src = null, el = null, timer = 0, stopped = false;
  const go = (buf) => {
    if (stopped) return;
    if (buf) {
      src = ctx.createBufferSource(); src.buffer = buf; src.connect(g);
      const now = ctx.currentTime;
      if (T >= now) src.start(T); else if (now - T < buf.duration) src.start(now, now - T);
      return;
    }
    // (From disk, or if it couldn't be had: an <audio> element, from
    // where it should be.)
    if (typeof Audio === "undefined") return;
    el = new Audio(TRACK_URL); el.volume = LEVEL;
    const start = () => {
      if (stopped || !el) return;
      const off = ctx.currentTime - T;
      if (off >= COMMERCIAL_MS / 1000) return;
      try { if (off > 0) el.currentTime = off; } catch (e) { /* from the top */ }
      const p = el.play(); if (p && p.catch) p.catch(() => {});
    };
    const wait = (T - ctx.currentTime) * 1000;
    if (wait > 0) timer = setTimeout(start, wait); else start();
  };
  if (!rendered.buffer && !rendered.promise) prepareCommercial();
  if (rendered.buffer) go(rendered.buffer);
  else if (rendered.promise) rendered.promise.then(go);
  else go(null);
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.015);
      if (el) { try { el.pause(); } catch (e) { /* done */ } el = null; }
      setTimeout(() => { try { if (src) src.stop(); } catch (e) { /* done */ } try { g.disconnect(); } catch (e) { /* gone */ } }, 200);
    },
    end: END,
  };
}
