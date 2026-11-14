/* The see-through lens: the City's and Noir's buildings dissolve where
   they stand between the camera and the board (ciudad-models.js SEE_CUT,
   ciudad-city.js seeRoof, noir-city.js seeThrough), in a cone round the
   line from the camera to the point the lens looks at (uFocus), as wide
   as uLens has it (0 shut, 1 open).

   That point was the view's target, and in these two worlds two fingers
   take the view out into the streets (theme.freeCamera's reach, 22 and 26
   from the middle): the lens went with it, cutting a hole in the city
   wherever the camera looked (user, a phone screenshot of the City, the
   hole over the blocks behind the board: "The peering lens for when
   you're at a low angle is showing up anywhere. So there's some kind of
   glitch that's causing it to not go away when it's not supposed to be
   there.").

   Now it looks at the board only: at the view's target pulled onto the
   board (the nearest point of the slab, on its face, in the board's own
   frame: the board turns under the camera), and it shuts as the view goes
   out over the city, open to OPEN past the slab's edge, shut by SHUT. So
   it opens only on the board, and only where something stands in front
   of it: a view from high over the board, or one out over the city, cuts
   nothing. */
import * as THREE from "three";

export const OPEN = 1.5, SHUT = 4.5;
const local = new THREE.Vector3();

/* Puts the lens's point in focus (world) for a view ({ target }) of a
   board group whose slab reaches hx, hz from its middle; returns how open
   the lens is. */
export function aimLens(focus, view, boardGroup, hx, hz) {
  local.copy(view.target);
  if (boardGroup) { boardGroup.updateWorldMatrix(true, false); boardGroup.worldToLocal(local); }
  const past = Math.hypot(Math.max(0, Math.abs(local.x) - hx), Math.max(0, Math.abs(local.z) - hz));
  focus.set(Math.max(-hx, Math.min(hx, local.x)), 0, Math.max(-hz, Math.min(hz, local.z)));
  if (boardGroup) boardGroup.localToWorld(focus);
  const k = Math.min(1, Math.max(0, (past - OPEN) / (SHUT - OPEN)));
  return 1 - k * k * (3 - 2 * k);
}
