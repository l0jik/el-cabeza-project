## 10. Other solved bugs worth remembering

- `camera.lookAt()` silently corrupts the camera matrix if given a plain
  `{x,y,z}` object instead of a real `THREE.Vector3` (it checks
  `.isVector3`, and failing that calls `Vector3.set(target, undefined,
  undefined)`, producing NaN). This is exactly the kind of bug that makes
  every subsequent "does it fit" check in a bisection search trivially
  return true, collapsing a zoom-fit search straight to `ZOOM_MIN` — real
  root cause of a "views always zoom in far too close" bug that looked
  unrelated on the surface. Any new fit/measurement code must construct
  real `Vector3`s.
- Singularity's intentionally-oversized decorative glow (bleeds past its
  own button) was making its scrolling ancestor show a scrollbar, since
  an oversized absolutely-positioned descendant counts toward scrollable
  overflow even when purely decorative. Fixed with `contain: layout` on
  the button, not by shrinking the glow.
- A missing `cabezaInDanger` import was caught only because the phase-2
  extraction smoke test actually *exercised* `computeTension` rather than
  just checking it imports — a reminder that the smoke tests earn their
  keep by calling real code paths, not just construction-checking.
- **The ending's crawl twitched up and down now and then** (2026-10-22;
  user: "The Star Wars scroll after the revelation sometimes vertically
  jitters. Please investigate. It should be smooth."). den-ending.js ran
  the crawl as one compositor animation but, every frame, measured its
  distance again (the words' height plus 0.8 of the screen's) and made
  the animation anew whenever that moved by 2 px (a font arriving, a
  phone's bar), and set its clock back to the scene's whenever the two
  were 150 ms apart. The scene's clock is performance.now() in the frame
  callback, the animation's the frame's own time, so one slow frame (a
  callback ahead of it taking 220 ms) put them 220 ms apart: snapped
  ahead, and the next frame snapped back. Measured (scratchpad
  crawl/measure.mjs, a 412x915 phone, a slow frame every 1.5 s): before,
  the animation made twice and its clock jumping +216 then -216 ms at every
  slow frame (about 5 px each way); after, one animation and no jumps.
  Now crawlFrame(): the distance measured once as it comes on (after the
  crawl's shown, so measured as it is), the animation never remade, its
  clock moved only by a deliberate skip() (crawlSkip vs skipMs); the
  crawl's faces (IBM Plex Sans 500, 600) fetched at the ending's start;
  and past the black frame() runs only the crawl and the menu, none of
  the void's figure, wisps or camera (nothing drawn there anyway), so the
  page's frames stay light while it goes.
- **The title splash hitched, the rewind after Begin worst** (2026-10-22;
  user: "The splash screen animation is, it kind of gets hung up. I think
  I especially notice it when it's after begin is pressed and it goes
  back."). Two causes, each measured by taking it away (scratchpad
  splash/measure.mjs, variants nofilter/nomask/nopaint/late): the
  backdrop canvas's CSS blur(16px), on an element four screens wide,
  recomputed every video frame (the compositor dropped every other
  frame; gone, a steady 30 fps); and the app mounting under the 4.8 s
  playback (7.5 s of long tasks, the longest 2.5 s). Fixed in
  apps/title-screen.js: the blur drawn in the canvas (offscreen 64 x 52,
  blurred into a 256 x 208 shown canvas, at most 18 paints a second), the
  app let in once the playback's over. The masks on the videos cost a
  little too (fewer skips without them) but were kept for the look.
- **A paused video's frame never reaches a VideoTexture** (2026-10-28,
  the den's commercial held on its first frame). three r128's
  VideoTexture sets needsUpdate only from requestVideoFrameCallback where
  the browser has it, which fires only when the video presents a new
  frame: one paused (or preloaded, never played) presents none, so the
  texture stays blank (here, the set's dark glass all through the hold)
  until it plays. Fixed in themes/den-commercial.js: while held, once
  readyState >= 2 and it isn't seeking, `texture.needsUpdate = true` once,
  again after each seek ("seeked"). Any other held or paused video on a
  texture needs the same. Seen only by reading the canvas back
  (gl.readPixels in a rAF after the app's render, tests/e2e-den-spot.mjs).
- **Light lines along the store's floor, flickering as the camera moved**
  (2026-10-31; user: "the floor has some Z fighting where there's some
  light lines with on the floor. You can see like there's a different.
  Yeah, check that. You'll see what I'm talking about. If you move the
  screen around, you'll kind of see it flicker too."). Not z-fighting:
  nothing solid overlapped (every opaque floor piece clipped against every
  other, exactly; the decals draw over with depthWrite off and a polygon
  offset, so they can't fight). They were cracks at T-junctions: in
  themes/tienda-store.js the tan aisle cross was two long strips laid over
  the gap between four tiled squares, so at the cross's four inner
  corners a corner of one piece lay partway along another piece's edge.
  The GPU rounds those two edges a little differently and leaves hairline
  gaps, the light fog-coloured background showing through, moving with
  the camera. SwiftShader (the tests' renderer) closes them, so no
  screenshot here showed it; the geometry did. The den's carpet round the
  pit (themes/den-room.js) was four strips the same way (84 T-junctions).
  Both are grids now, each piece meeting the next corner to corner: the
  aisle cross as five cells of the 3 x 3 grid its lines make (the
  "tienda-floor-aisles" mesh), the carpet as the eight cells round the
  pit. Test: tests/e2e-floor-seams.mjs (every wide, mostly covered, upward
  solid surface in the store and the den; no corner inside an edge only
  one triangle has; it found the old floors' 4 and 84). Any floor or wall
  laid from pieces wants the same: split them where their lines cross.
- **The picture went out on a Moto G Stylus 5G (2022)** (2026-11-06;
  user, a photo of the fresh link on that phone: a white screen, a small
  sad face in a box at its top left, the EL CABEZA badge, the corner
  piece a white cube in its glow, the two buttons at the bottom left: "I
  sent the link to a Moto G Stylus 5G 2022, and it opened it, the link,
  but this is what came out. There's something not right here."). The
  white and the sad face are the browser's own: Chrome's "broken canvas",
  painted in place of a canvas whose WebGL context is lost and not given
  back. Reproduced exactly by losing both contexts (the board's,
  `board-canvas`, and the corner piece's, `dock-piece-canvas`) after Open
  the box and keeping the board's canvas off its own layer: white, the
  sad face at its top left, the DOM (badge, buttons, the dock's glow) on
  top. What it isn't: the store too heavy for the phone (measured at its
  tier, low: about 42 MB of textures, 122 draw calls, 31k triangles, one
  1024 shadow map, the canvas 350x777 after the governor); too many
  contexts (five made on the fresh path, only the two alive; the rest,
  the quality check and woodSwatch's two, lost at once; Android keeps
  eight); no WebGL at all (that gives an empty page: the renderer throws
  and React's tree goes). What it most likely was: the phone's graphics
  restarting (a driver reset, perhaps at the first tap's switch to full
  screen) and Chrome then refusing the contexts back (after a GPU crash
  it blocks WebGL for a while, or for the site; a restore attempt then
  just gives up). When the browser does give them back, three.js r128
  puts back everything it had uploaded: measured, the store and the
  corner piece came back whole (an earlier probe that "showed" otherwise
  had asked a lost context for its lose-context extension, which a lost
  context never gives, so nothing was ever restored). Fixed:
  chassis/gl-watch.js (watchGL on each canvas: onLost; onBack redraws
  the shadows at once; not given back within STUCK_MS 4 s of the page
  being in view, onStuck) and chassis/PictureOut.jsx (on the loss, at
  once, the world's own dark over the whole screen with "Bringing the
  picture back…", so the browser's white and its sad face never show;
  stuck, a card in the world's look, "The picture went out", one button,
  "Bring the picture back", that loads the page again; the story and
  settings kept, a game on the board starts over; cover and card go by
  themselves if the picture comes back). With no WebGL at all (webglWorks(), one
  throwaway context lost at once; ?nogl to see it), the chassis's default
  export renders "The 3D picture won't start" with Try again instead of
  the scene (ElCabeza3DScene). Words in es and vi. Test:
  tests/e2e-picture-out.mjs (lost: the cover at once, no button; given
  back: it goes, drawn again; lost for good: the card after the wait,
  given back late: it goes; the
  button reloads; --disable-webgl on Nova's page and Futuris's: the card,
  no page errors). Not known: what restarted the Moto's graphics; if it
  keeps happening there, ?quality=low is already its tier.
  Then (user: "And it opened in Chrome, by the way. I should be clear,
  this is what showed up after I clicked open the box."): that tap is the
  one that takes the page full screen (the chassis's first tap and the
  store lid's own ask), and it also starts the store's sound (small: a
  reel decodes to 12 to 16 MB) and lifts the lid (a CSS tilt and fade). The
  switch to full screen, the canvases resized under it, is the suspect
  (known trouble on some Android phones). So gl-watch.js notes when the
  page went full screen and the last tap; a loss that isn't given back
  within FULLSCREEN_SUSPECT_MS (6 s) of going full screen sets
  `elcabeza-device:no-auto-fullscreen` (outside the game's prefixes: ?fresh
  leaves it, saves don't carry it), and every automatic ask for full
  screen checks autoFullscreenOk() (the chassis's first tap, the store's
  lid, the den's scene preview, the title screen's own copy of the key);
  the full-screen button still works. The card then adds "It went as the
  screen switched to full size, so on this device the game won't do that
  by itself any more. The full-screen button still does." and a small
  line of what happened just before ("0.7 s after full screen · 0.8 s
  after a tap · the GPU's name"; "No switch to full screen" when there
  wasn't one), for the user's next photo: it says whether full screen is
  really the cause.
