/* Which way a drag turns the board: where you touch (user, of three ways
   to try: "'C. Where you touch' seems the most correct option, but there's
   still the issue of reversal when crossing the vertical, mid-screen
   boundary").

   The side of the board under the finger (or the mouse) follows it: begun
   above the board's middle on screen, its far side, a drag right turns
   it as that side goes (theta up); begun below, its near side, the other
   way. And as the finger goes: once it's well into the other half, that
   half's side takes over, so it's always the side under it that follows.
   Kept from the start for the whole drag, it had the board going against
   the finger once past the middle, and a stir round the board turned
   back as it came along the bottom. "Well into": a band either side of
   the middle, so a drag along the middle keeps its way and doesn't
   flicker.

   The middle is the board's, through the camera as it is (panned, a
   theme's own camera, the Room view needn't have it mid-screen); with it
   behind the camera, all of what's seen is beyond it, the far side. */
import * as THREE from "three";

const at = new THREE.Vector3();
const BAND = 0.07; // of the view's height, either side of the middle (at least 24 px)

// The board's middle on screen (a client y), or null with it behind the camera.
export function boardMiddleY(three, rect) {
  const { camera: c, boardGroup: g } = three || {};
  if (!c || !g) return rect.top + rect.height / 2;
  g.getWorldPosition(at);
  c.updateMatrixWorld();
  at.applyMatrix4(c.matrixWorldInverse);
  if (at.z >= -1e-3) return null;
  at.applyMatrix4(c.projectionMatrix);
  return rect.top + ((1 - at.y) / 2) * rect.height;
}

// The side under a pointer coming down: 1, the far side (a drag right
// turns theta up); -1, the near side.
export function sideAt(three, rect, clientY) {
  const mid = boardMiddleY(three, rect);
  return mid == null || clientY < mid ? 1 : -1;
}

// The side as the pointer goes: the one it had, or the other once the
// pointer's well into the other half.
export function sideAsItGoes(side, three, rect, clientY) {
  const mid = boardMiddleY(three, rect);
  if (mid == null) return 1;
  const band = Math.max(24, rect.height * BAND);
  if (side > 0 && clientY > mid + band) return -1;
  if (side < 0 && clientY < mid - band) return 1;
  return side;
}
