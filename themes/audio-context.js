/* An AudioContext at the device's own rate, up to 48 kHz (user, on a
   laptop: "When you click on the word singularity on a desktop version
   ... The sound drops out, and then the next thing you actually hear is
   the ringing when you see the sphere").

   A context runs at the output device's rate unless told otherwise, and a
   computer's sound card may be set to 96 or 192 kHz (some laptops come
   that way). Every node then does two or four times the work, the long
   reverbs of the way into the Singularity most of all (their cost grows
   with the rate and the reverb's length in samples): the audio thread
   can't keep up, and what it can't render in time comes out as silence.
   Above 48 kHz, then, a second context at 48 kHz (the browser resamples
   to the card, cheaply) and the first closed; at 48 kHz or less, the
   device's own, as before. (A browser that takes no rate keeps its own.) */
export const MAX_RATE = 48000;

export function makeAudioContext(opts) {
  const W = typeof window !== "undefined" ? window : null;
  const AC = W && (W.AudioContext || W.webkitAudioContext);
  if (!AC) return null;
  const ctx = opts ? new AC(opts) : new AC();
  if (!(ctx.sampleRate > MAX_RATE)) return ctx;
  let capped = null;
  try { capped = new AC({ ...(opts || {}), sampleRate: MAX_RATE }); } catch (e) { capped = null; }
  if (!capped || capped.sampleRate > MAX_RATE) {
    if (capped) { try { capped.close(); } catch (e) { /* as it is */ } }
    return ctx;
  }
  try { ctx.close(); } catch (e) { /* closed with the page */ }
  return capped;
}
