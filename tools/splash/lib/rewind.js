/* The title screen's way out (user: "When clicking begin on the splash
   screen, it should play the animation in reverse"): a video's own frames
   from the held logo (8.5 s, where the title screen's loop begins) back to
   its first, the board, quicker than it came: through the breath and the
   ghost's rise, NOVA closing back into its line, the emblem coming apart
   into the board, EL CABEZA's letters drawn off it. REWIND maps the
   rewind's seconds to the video's (a monotone cubic through them), eased
   in from the loop's own speed and set down gently on the board. 4.8 s
   (user, of the first, 2.75 s at four times the video's speed: "the
   reverse sequence needs to go a little bit more slowly. It happens so
   fast you don't really get to see anything"): NOVA closes at twice the
   speed, the emblem held whole (3.5 to 5 s, nothing moving) goes by
   quickly, and the emblem comes apart into the board (3.25 to 1.25 s,
   where the change is) at about its own speed, 1.7 s of it.
   (render.mjs rewind; sounds.mjs times the pieces' landings by it.) */
export const REWIND = [[0, 8.5], [0.6, 6.8], [1.35, 5.2], [1.9, 3.3], [3.6, 1.25], [4.8, 0]];
const REWIND_IN = 1.4, REWIND_OUT = 0.6; // the video's seconds a second, at its start and its end
export const REWIND_LEN = REWIND[REWIND.length - 1][0];

// The video's second at u seconds into the rewind.
export function rewindAt(u) {
  const P = REWIND, n = P.length - 1;
  if (u <= P[0][0]) return P[0][1];
  if (u >= P[n][0]) return P[n][1];
  const h = [], d = [];
  for (let i = 0; i < n; i++) { h.push(P[i + 1][0] - P[i][0]); d.push((P[i + 1][1] - P[i][1]) / h[i]); }
  const m = [Math.max(d[0] * 3, -REWIND_IN)];
  for (let i = 1; i < n; i++) {
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m.push(d[i - 1] * d[i] <= 0 ? 0 : (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]));
  }
  m.push(Math.max(d[n - 1] * 3, -REWIND_OUT));
  let i = 0;
  while (u > P[i + 1][0]) i++;
  const s = (u - P[i][0]) / h[i], s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * P[i][1] + (s3 - 2 * s2 + s) * h[i] * m[i] + (-2 * s3 + 3 * s2) * P[i + 1][1] + (s3 - s2) * h[i] * m[i + 1];
}

// When in the rewind the video's second T comes round (it only goes back).
export function rewindTimeOf(T) {
  let lo = 0, hi = REWIND_LEN;
  for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (rewindAt(mid) > T) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
