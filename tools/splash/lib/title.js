/* The title over every video (user: "initially just the word El Cabeza will
   be there, but then there's going to be like an additional splash of the
   added word Nova. Make these look refined and classy"). EL CABEZA comes up
   over the board photo in the first second, its letters closing in, and
   stays, steady, while the picture changes under it. Once the poster has
   settled, NOVA has its own moment (lockup.js), a glint crosses the name,
   and it all holds; on the logo posters NOVA breathes twice instead (user:
   "At the end, have Nova pulsing in a subtle way"). */
import { span, smooth } from "./anim.js";

export const NOVA_AT = 0.3; // after the poster settles
export const NOVA_LEN = 1.5;
export const HOLD = 1.4;
// The breaths: from just after NOVA is in, each this long, then a moment still.
// (pulse: true for BREATHS of them, or how many: the title screen's Horizon
// has three, and loops the last two.)
export const BREATH = 1.7, BREATHS = 2;
export const BREATH_AT = 1.6;
const STILL = 0.2;
const breaths = (pulse) => (pulse === true ? BREATHS : pulse || 0);

export const length = (settle, pulse = false) => settle + NOVA_AT + (pulse ? BREATH_AT + breaths(pulse) * BREATH + STILL : NOVA_LEN + HOLD);

// A breath's swell at p seconds into the n breaths: out and back, slowly.
const breath = (p, n) => (p <= 0 || p >= n * BREATH ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * p) / BREATH));

/* The title's state at t. settle: when the version's poster is whole;
   inkAt: when the ground under the name turns light (poster 5's paper), or
   null where it stays dark; pulse: NOVA breathes at the end. */
export function titleState(t, settle, inkAt, pulse = false) {
  const n0 = settle + NOVA_AT;
  return {
    cabeza: span(t, 0.05, 1.25),
    ink: inkAt == null ? 1 : smooth(span(t, inkAt - 0.35, inkAt + 0.35)),
    halo: 1 - smooth(span(t, settle - 0.3, settle + 0.3)),
    nova: span(t, n0, n0 + NOVA_LEN),
    sheen: span(t, n0 + 0.5 * NOVA_LEN, n0 + 1.3 * NOVA_LEN),
    pulse: pulse ? breath(t - n0 - BREATH_AT, breaths(pulse)) : 0,
  };
}
