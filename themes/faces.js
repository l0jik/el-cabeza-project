/* The faces of the lines between scenes, kept with the pages (user:
   "whenever there's any of that sort of segue text font, there's
   something wrong with it": "Later, at home." came up in a stand-in face,
   turned to Bodoni Moda (its face then) as it faded in, and back to the
   stand-in when the place changed under it, since the face came in with
   each place's sheet from Google Fonts and went with it; the store's
   "Later that day…" came up in a stand-in too, its comic lettering
   fetched only as it opened).

   Files beside the page (build/build.js FACE_FILES), each added to the
   page's fonts once, under a name no place's sheet uses, so a change of
   place can't take it away; fetched ahead (loadFaces), and what shows
   them waits for them (facesReady), a moment at most: past that, a
   stand-in from the start rather than a wait. */

// Google Fonts' splits: each file draws only its own letters.
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const VIETNAMESE = "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB";

const FACES = {
  // The story's captions (apps/novaStory.jsx StoryCut): Fraunces, soft
  // (user: "go with option C, Fraunces soft, for the captions"), cut at
  // the captions' two settings (tools/caption_face.py): the line upright
  // at 600, the second line italic at 400. Latin and Vietnamese letters
  // in separate files, in the order of Google's sheet.
  caption: [
    ["EC Caption", "el-cabeza-face-fraunces-vietnamese.woff2", { weight: "600", unicodeRange: VIETNAMESE }],
    ["EC Caption", "el-cabeza-face-fraunces.woff2", { weight: "600", unicodeRange: LATIN }],
    ["EC Caption", "el-cabeza-face-fraunces-italic-vietnamese.woff2", { weight: "400", style: "italic", unicodeRange: VIETNAMESE }],
    ["EC Caption", "el-cabeza-face-fraunces-italic.woff2", { weight: "400", style: "italic", unicodeRange: LATIN }],
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
