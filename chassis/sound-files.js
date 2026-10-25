/* The game's recordings: each one ships as Opus, with its MP3 beside it
   (user: "Let's go with Opus, a safer quality": tools/opus_twins.py makes
   the twins at two thirds of the MP3's bitrate, build/build.js puts each
   beside its MP3). The code names a recording by its MP3; these pick the
   file. Opus wherever the browser plays it (Chrome, Edge, Firefox,
   Android; Safari from iOS 18.4 and macOS 15.4), the MP3 everywhere else,
   and the MP3 too if the Opus can't be had or decoded after all. */

const twinOf = (url) => url.replace(/\.mp3(?=$|[?#])/i, ".opus");

export const PLAYS_OPUS = (() => {
  try {
    const a = document.createElement("audio");
    return !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"'));
  } catch (e) {
    return false;
  }
})();

// The file to ask for.
export const soundUrl = (url) => (PLAYS_OPUS ? twinOf(url) : url);

const fetchBytesOf = (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)));
// (decodeAudioData's promise, or its callbacks where an older Safari has no promise.)
export const decodeBytes = (ctx, bytes) => new Promise((res, rej) => {
  const p = ctx.decodeAudioData(bytes, res, rej);
  if (p && p.then) p.then(res, rej);
});

// The recording's bytes (for a caller that decodes them itself): the
// Opus, or the MP3 if the Opus can't be fetched.
export function fetchSoundBytes(url) {
  const u = soundUrl(url);
  return u === url ? fetchBytesOf(url) : fetchBytesOf(u).catch(() => fetchBytesOf(url));
}

// Fetched and decoded for Web Audio: the Opus, or the MP3 if the Opus
// can't be fetched or decoded.
export function loadSound(ctx, url) {
  const u = soundUrl(url);
  const get = (v) => fetchBytesOf(v).then((b) => decodeBytes(ctx, b));
  return u === url ? get(url) : get(u).catch(() => get(url));
}

// An <audio> playing the recording: the Opus, over to the MP3 once if the
// Opus won't play.
export function soundElement(url, el = typeof Audio !== "undefined" ? new Audio() : null) {
  if (!el) return null;
  const u = soundUrl(url);
  if (u !== url) {
    const back = () => {
      el.removeEventListener("error", back);
      el.src = url;
      try { el.load(); } catch (e) { /* as it is */ }
    };
    el.addEventListener("error", back);
  }
  el.src = u;
  return el;
}
