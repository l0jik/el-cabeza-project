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
