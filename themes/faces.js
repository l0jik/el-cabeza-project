/* The faces of the lines between scenes, kept with the pages (user:
   "whenever there's any of that sort of segue text font, there's
   something wrong with it": "Later, at home." came up in a stand-in face,
   turned to Bodoni Moda as it faded in, and back to the stand-in when the
   place changed under it, since the face came in with each place's sheet
   from Google Fonts and went with it; the store's "Later that day…" came
   up in a stand-in too, its comic lettering fetched only as it opened).

   Files beside the page (build/build.js FACE_FILES), each added to the
   page's fonts once, under a name no place's sheet uses, so a change of
   place can't take it away; fetched ahead (loadFaces), and what shows
   them waits for them (facesReady), a moment at most: past that, a
   stand-in from the start rather than a wait. */

const FACES = {
  // The story's captions (apps/novaStory.jsx StoryCut): Bodoni Moda, its
  // latin letters, upright and italic (variable, 400 to 900).
  caption: [
    ["EC Caption", "el-cabeza-face-bodoni.woff2", { weight: "400 900" }],
    ["EC Caption", "el-cabeza-face-bodoni-italic.woff2", { weight: "400 900", style: "italic" }],
  ],
  // The Games counter's clipping (themes/tienda-overlay.js ClerkScene):
  // Comic Neue Bold for its captions and balloons, Bangers for its
  // buttons.
  comic: [
    ["EC Comic", "el-cabeza-face-comic-neue-bold.woff2", { weight: "700" }],
    ["EC Comic Title", "el-cabeza-face-bangers.woff2", {}],
  ],
};

const loading = {}, made = {};
// Fetch a set (once); resolves true once all of it is in, false if it can't be.
export function loadFaces(set) {
  if (loading[set]) return loading[set];
  if (typeof document === "undefined" || !document.fonts || typeof FontFace === "undefined") return (loading[set] = Promise.resolve(false));
  try {
    const faces = FACES[set].map(([family, file, desc]) => new FontFace(family, `url(${file}) format("woff2")`, { display: "block", ...desc }));
    faces.forEach((f) => document.fonts.add(f));
    made[set] = faces;
    loading[set] = Promise.all(faces.map((f) => f.load())).then(() => true, () => false);
  } catch (e) {
    loading[set] = Promise.resolve(false);
  }
  return loading[set];
}

// Whether the set's in now (fetching it if it's not been asked for).
export function facesIn(set) {
  loadFaces(set);
  return !!made[set] && made[set].every((f) => f.status === "loaded");
}

// Resolves once the set is in, or after `ms` regardless.
export function facesReady(set, ms = 1500) {
  return Promise.race([loadFaces(set), new Promise((r) => setTimeout(() => r(false), ms))]);
}

// (Test-only: whether each set is in.)
if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) {
  window.__EC_FACES__ = () => Object.fromEntries(Object.keys(FACES).map((k) => [k, !loading[k] ? "not asked" : made[k] ? made[k].map((f) => f.status).join(" ") : "none"]));
}
