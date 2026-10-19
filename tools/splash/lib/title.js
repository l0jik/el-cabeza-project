/* The title over every video (user: "initially just the word El Cabeza will
   be there, but then there's going to be like an additional splash of the
   added word Nova. Make these look refined and classy"). EL CABEZA comes up
   over the board photo in the first second, its letters closing in, and
   stays, steady, while the picture changes under it. Once the poster has
   settled, NOVA has its own moment (lockup.js: each treatment its own
   entrance), a glint crosses the name, and it all holds. */
import { span, smooth } from "./anim.js";

export const NOVA_AT = 0.3; // after the poster settles
export const HOLD = 1.4;

// len: NOVA's entrance, by treatment (lockup.js)
export const length = (settle, len) => settle + NOVA_AT + len + HOLD;

/* The title's state at t. settle: when the version's poster is whole;
   inkAt: when the ground under the name turns light (poster 5's paper), or
   null where it stays dark; len: NOVA's entrance; sheen: when the glint
   crosses, in lengths of the entrance after it starts. */
export function titleState(t, settle, inkAt, len, sheen = [0.5, 1.3]) {
  const n0 = settle + NOVA_AT;
  return {
    cabeza: span(t, 0.05, 1.25),
    ink: inkAt == null ? 1 : smooth(span(t, inkAt - 0.35, inkAt + 0.35)),
    halo: 1 - smooth(span(t, settle - 0.3, settle + 0.3)),
    nova: span(t, n0, n0 + len),
    sheen: span(t, n0 + sheen[0] * len, n0 + sheen[1] * len),
  };
}
